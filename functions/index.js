const functions = require("firebase-functions");
const FirebaseClient = require("./datahandlers/firebaseClient");
const VmpClient = require("./datahandlers/vmpClient");
const EmailClient = require("./datahandlers/emailClient");
const firebaseAdmin = require("firebase-admin");
const serviceAccount = require("./configs/serviceAccountKey.json");
const rp = require("request-promise");
const SortArray = require("sort-array");
const { user } = require("firebase-functions/lib/providers/auth");

const allTimeEarliestDate = new Date(1594166400000);
const td = new Date();
const allowedTimeSpans = {
  "7days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 7),
  "14days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 14),
  "30days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 30),
  "90days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 90),
};

// Initialize the app with a service account, granting admin privileges
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: "https://spritjakt.firebaseio.com/",
});

const runtimeOpts = {
  timeoutSeconds: 540,
  memory: "512MB",
};

function httpCorsOptions(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  var exit = false;
  if (req.method === "OPTIONS") {
    // Send response to OPTIONS requests
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
    res.status(204).send("");
    exit = true;
  }
  //PingCall just to keep function alive
  if (req.query.pingCall) {
    res.send("It lives another day...");
    exit = true;
  }

  return { res, exit };
}

exports.fetchProducts = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("45 6 * * *").timeZone("Europe/Paris").onRun(async (context) => {
  await FirebaseClient.UpdateProductPrices(await VmpClient.FetchFreshProducts());
});

exports.fetchStocks = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("30 9 * * *").timeZone("Europe/Paris").onRun(async (context) => {
  let moreStocksToFetch = true;
  let freshStocks = [];
  let tries = 0;
  while (moreStocksToFetch && tries < 20) {
    let { totalCount, stocks, error } = await VmpClient.FetchFreshStocks(freshStocks.length);

    freshStocks = freshStocks.concat(stocks);
    console.info("freshStocks: " + freshStocks.length);

    if ((totalCount === freshStocks.length || stocks.length === 0) && !error) {
      moreStocksToFetch = false;
    } else if (error) {
      console.info("Could not fetch stocks, waiting 10 seconds until retry");
      await new Promise(r => setTimeout(r, 10000));
    }
    tries++;
  }

  if (freshStocks.length > 0) {
    await FirebaseClient.SetStockUpdateList(freshStocks, true);
  }
});

exports.getOnSaleProductsHttp = functions.region("europe-west1").runWith(runtimeOpts).https.onRequest(async (req, oldRes) => {
  let { res, exit } = httpCorsOptions(req, oldRes);
  if (exit) {
    return;
  }

  let timeSpan = allTimeEarliestDate;

  if (
    allowedTimeSpans[req.query.timeSpan] !== undefined &&
    allowedTimeSpans[req.query.timeSpan].getTime() >
    allTimeEarliestDate.getTime()
  ) {
    timeSpan = allowedTimeSpans[req.query.timeSpan];
  }

  var lastWriteTime = await FirebaseClient.FetchLastWriteTime();
  lastWriteTime.BasePriceTime = timeSpan.getTime();

  var products = await FirebaseClient.FetchOnSaleProductsFireStore(
    timeSpan.getTime()
  );

  return res.send({
    products: products,
    LastWriteTime: lastWriteTime,
  });
});

exports.keepGetOnSaleProductsHttpAlive = functions.pubsub.schedule("every 3 minutes").timeZone("Europe/Paris").onRun(async (context) => {
  let functions = [
    "https://europe-west1-spritjakt.cloudfunctions.net/productSearchAdvanced",
    "https://europe-west1-spritjakt.cloudfunctions.net/getOnSaleProductsHttp",
  ];
  for (const i in functions) {
    const uri = functions[i];
    let options = {
      uri: uri,
      qs: {
        pingCall: true,
      },
      json: true,
    };
    await rp(options)
      .then(function (res) {
        console.log(res);
      })
      .catch(function (err) {
        console.log(err);
      });
  }
});

exports.productSearchAdvanced = functions.region("europe-west1").runWith(runtimeOpts).https.onRequest(async (req, oldRes) => {
  let { res, exit } = httpCorsOptions(req, oldRes);
  if (exit) {
    return;
  }
  if (
    req.query.searchString === undefined ||
    req.query.searchString.trim().length === 0
  ) {
    return res.status(400).send();
  }

  searchString = req.query.searchString.toLowerCase();
  let stringList = searchString.split(" ").filter((s) => s.length > 1);
  var products = await FirebaseClient.ProductSearchAdvanced(stringList);

  let matchingProducts = [];
  let highestScore = 0;
  Object.keys(products).forEach((id) => {
    let p = products[id];

    let nameList = p.Name.toLowerCase()
      .split(" ")
      .filter((s) => s.length > 1);

    p.numberOfMatches = 0;
    for (i in stringList) {
      if (nameList.includes(stringList[i])) {
        p.numberOfMatches++;
        if (i !== 0 && nameList.includes(stringList[i - 1])) {
          p.numberOfMatches++;
        }
      }
      if (nameList[i] === stringList[i]) {
        p.numberOfMatches++;
      }
    }

    highestScore =
      p.numberOfMatches > highestScore ? p.numberOfMatches : highestScore;

    matchingProducts.push(p);
  });

  SortArray(matchingProducts, {
    by: ["numberOfMatches", "Name"],
    order: "desc",
  });
  matchingProducts = matchingProducts
    .splice(0, 20)
    .filter((p) => p.numberOfMatches >= highestScore - 3);

  matchingProducts.map((p) => {
    p.PriceHistorySorted = SortArray(Object.keys(p.PriceHistory), {
      order: "desc",
    });

    p.LatestPrice = p.PriceHistory[p.PriceHistorySorted[0]];

    let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(
      (priceDate) =>
        priceDate <= allTimeEarliestDate &&
        priceDate !== p.PriceHistorySorted[0]
    );

    if (priceHistorySortedAndFiltered.length !== 0) {
      let oldestPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]];
      p.ComparingPrice = oldestPrice;
      p.SortingDiscount = (p.LatestPrice / oldestPrice) * 100;
      p.Discount = (p.SortingDiscount - 100).toFixed(1);
    } else {
      p.SortingDiscount = 100;
    }
    p = FirebaseClient.PrepProduct(p);
  });

  return res.send(matchingProducts.splice(0, 20));
});

exports.stockUpdateListener = functions.region("europe-west1").runWith(runtimeOpts).database.ref("/StocksToBeFetched/").onWrite(async (change, context) => {
  // Exit when the data is deleted.
  if (!change.after.exists()) {
    return null;
  }

  const newValue = change.after.val();

  const count = newValue.length > 500 ? 500 : newValue.length;
  console.log(newValue.length);
  for (let i = 0; i < count; i++) {
    if (newValue[i] !== undefined) {
      newValue[i].Stores = await VmpClient.FetchStoreStock(
        newValue[i].productId
      );
      await FirebaseClient.UpdateProductStock(newValue[i]);
    }
    newValue.splice(i, 1);
  }

  return await FirebaseClient.SetStockUpdateList(newValue);
});

exports.getStoresHttp = functions.region("europe-west1").runWith(runtimeOpts).https.onRequest(async (req, oldRes) => {
  let { res, exit } = httpCorsOptions(req, oldRes);
  if (exit) {
    return;
  }
  return res.send(await FirebaseClient.GetStores());
});


function validateEmail(email) {
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

exports.registerEmailHttp = functions.region("europe-west1").runWith(runtimeOpts).https.onRequest(async (req, oldRes) => {
  let { res, exit } = httpCorsOptions(req, oldRes);
  if (exit) {
    return;
  }
  if (req.query.email === undefined || !validateEmail(req.query.email)) {
    return res.status(400).send();
  }

  let email = req.query.email.toLowerCase();

  let users = await FirebaseClient.GetUsers();

  if (users.find(u => u.Email === email)) {
    return res.status(409).send("Email already exist");
  }

  if (await FirebaseClient.RegisterUser(email)) {
    return res.status(201).send("Email registered");
  }
  return res.status(500).send("Something went wrong");
});

exports.sendNewsLetterEmails = functions.region("europe-west1").runWith(runtimeOpts).database.ref("/NewsLetterProducts/").onWrite(async (change, context) => {
  // Exit when the data is deleted.
  if (!change.after.exists()) {
    return null;
  }
  const newsLetterProducts = change.after.val();
  const users = await FirebaseClient.GetUsers();
  var emails = [];
  users.map(u => emails.push(u.Email));
  const emailClient = new EmailClient(newsLetterProducts, emails);

  await emailClient.SendEmails();
  await FirebaseClient.SetNewsLetterProducts([]);
  return null;
});

exports.removeEmailHttp = functions.region("europe-west1").runWith(runtimeOpts).https.onRequest(async (req, oldRes) => {
  let { res, exit } = httpCorsOptions(req, oldRes);
  if (exit) {
    return;
  }
  if (req.query.email === undefined || !validateEmail(req.query.email)) {
    return res.status(400).send();
  }

  if (await FirebaseClient.RemoveUser(req.query.email)) {
    return res.send("Email removed");
  }

  return res.send("Something went wrong");
});