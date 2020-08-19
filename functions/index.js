const functions = require( 'firebase-functions');
const FirebaseClient = require( "./datahandlers/firebaseClient");
const VmpClient = require( "./datahandlers/vmpClient");
const firebaseAdmin = require("firebase-admin");
const serviceAccount = require("./configs/serviceAccountKey.json");
const rp = require( 'request-promise');
const SortArray = require('sort-array');

const allTimeEarliestDate = new Date(1594166400000);
const td = new Date();
const allowedTimeSpans = {
  "7days":  new Date( td.getFullYear(), td.getMonth(), (td.getDate() -7)),
  "14days":  new Date( td.getFullYear(), td.getMonth(), (td.getDate() -14)),
  "30days":  new Date( td.getFullYear(), td.getMonth(), (td.getDate() -30)),
  "90days":  new Date( td.getFullYear(), td.getMonth(), (td.getDate() -90)),
};

// Initialize the app with a service account, granting admin privileges
firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: "https://spritjakt.firebaseio.com/"
  });
  
const runtimeOpts = {
    timeoutSeconds: 540,
    memory: '512MB'
}


exports.fetchProducts = functions.region('europe-west1').runWith(runtimeOpts).pubsub.schedule('15 6 * * *').timeZone("Europe/Paris").onRun(async (context) => {
    await FirebaseClient.UpdateProductPrices(await VmpClient.FetchFreshProducts());
});

exports.updateStocks = functions.region('europe-west1').runWith(runtimeOpts).pubsub.schedule('15 8 * * *').timeZone("Europe/Paris").onRun(async (context) => {
  let moreStocksToFetch = true;
  let freshStocks = [];
  let tries = 0;
  while(moreStocksToFetch && tries < 10 ){
     
    let {totalCount, stocks} = await VmpClient.FetchFreshStocks(freshStocks.length);
 
    freshStocks = freshStocks.concat(stocks);
    console.info("freshStocks: " + freshStocks.length);

    if(totalCount === freshStocks.length || stocks.length === 0){
      moreStocksToFetch = false;
    }
    tries++;
  }
  if(freshStocks.length > 0){
    await FirebaseClient.SetStockUpdateList(freshStocks);
  }
});

exports.GetOnSaleProductsHttp = functions.region('europe-west1').runWith(runtimeOpts).https.onRequest(async (req, res) => {

    res.set('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
      // Send response to OPTIONS requests
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '3600');
      return res.status(204).send('');
    }else{
      
      //PingCall just to keep function alive
      if(req.query.pingCall){
        return res.send("It lives another day...");
      }else{

        let timeSpan = allTimeEarliestDate;
 
        if( allowedTimeSpans[req.query.timeSpan] !== undefined && allowedTimeSpans[req.query.timeSpan].getTime() > allTimeEarliestDate.getTime() ){
          timeSpan = allowedTimeSpans[req.query.timeSpan];
        }

        var lastWriteTime = await FirebaseClient.FetchLastWriteTime();
        lastWriteTime.BasePriceTime = timeSpan.getTime();

        var products = await FirebaseClient.FetchOnSaleProductsFireStore(timeSpan.getTime());
       
        var productsWithPriceChange = [];

        if(products){
          console.log(Object.keys(products).length);
          console.log(req.query.timeSpan);
          Object.keys(products).forEach(id => {
            let p = products[id];
            p.PriceHistorySorted = SortArray(Object.keys(p.PriceHistory), {order: "desc"});
            
            if(p.PriceHistorySorted.length === 1) {
              return;
            }
            
            p.LatestPrice = p.PriceHistory[p.PriceHistorySorted[0]];

            let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(priceDate => ( priceDate <= lastWriteTime.BasePriceTime && priceDate !== p.PriceHistorySorted[0]));
            
            if(priceHistorySortedAndFiltered.length === 0 ){
             return;
            }
            
            let oldestPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]]; 
            p.ComparingPrice = oldestPrice;
            p.SortingDiscount = (p.LatestPrice/oldestPrice*100);
            p.Discount = (p.SortingDiscount - 100).toFixed(1);
            
            if(p.SortingDiscount !== 100){

              if(p.SubType && p.SubType.includes("Brennevin,") ){
                p.SubType = "Brennevin";
              }
              if(p.SubType && p.SubType.includes("Sterkvin, annen")){
                p.SubType = "Sterkvin";
              }
              if(p.SubType == undefined){
                p.SubType = p.Type;
              }
              
              if(p.Stock === undefined){
                p.Stock = {
                  Stores: []
                };
              }
              if(p.Stock.Stores === undefined){
                p.Stock.stock = p.Stock.Stock
                delete p.Stock.Stock;
                p.Stock.Stores = [];
              }
              productsWithPriceChange.push(p);
            }
          });
        }
        return res.send({products: productsWithPriceChange, LastWriteTime: lastWriteTime});
      }

    }
  });

exports.keepGetOnSaleProductsHttpAlive = functions.pubsub.schedule('every 3 minutes').timeZone("Europe/Paris").onRun(async (context) => {
    let options =  {
      uri : "https://europe-west1-spritjakt.cloudfunctions.net/GetOnSaleProductsHttp",
      qs:{
        pingCall: true
      },
      json: true
    }
     await rp(options)
    .then(function (res) {
      console.log(res);
    })
    .catch(function (err) {
      console.log(err);
    });
    options =  {
      uri : "https://europe-west1-spritjakt.cloudfunctions.net/productSearch",
      qs:{
        pingCall: true
      },
      json: true
    }
     await rp(options)
    .then(function (res) {
      console.log(res);
    })
    .catch(function (err) {
      console.log(err);
    });
});

exports.productSearchAdvanced = functions.region('europe-west1').runWith(runtimeOpts).https.onRequest(async (req, res) => {

  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    // Send response to OPTIONS requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    res.status(204).send('');
  }else{
    if(req.query.pingCall){
      return res.send("It lives another day...");
    }else{
    if(req.query.searchString === undefined || req.query.searchString.trim().length === 0){
      return res.status(400).send();
      }
    }
    searchString = req.query.searchString.toLowerCase();
    let stringList = searchString.split(" ").filter(s => s.length > 1);
    var products = await FirebaseClient.ProductSearchAdvanced(stringList);

    let matchingProducts = [];
    Object.keys(products).forEach(id => {
      let p = products[id];

      let nameList = p.Name.toLowerCase().split(" ").filter(s => s.length > 1);

      p.numberOfMatches = 0;
      for( i in stringList){
        
        if(nameList.includes(stringList[i])){
          p.numberOfMatches++;
          if( i !== 0 && nameList.includes(stringList[i-1])){
            p.numberOfMatches++;
          }
        }
        if(nameList[i] === stringList[i]){
          p.numberOfMatches++;
        }
      }
      matchingProducts.push(p);
    });

    SortArray(matchingProducts, {
      by: ["numberOfMatches", "Name"],
      order: "desc"
    });
    matchingProducts = matchingProducts.splice(0,20);

    matchingProducts.map(p => {

      p.PriceHistorySorted = SortArray(Object.keys(p.PriceHistory), {order: "desc"});
      
      p.LatestPrice = p.PriceHistory[p.PriceHistorySorted[0]];

      let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(priceDate => ( priceDate <= allTimeEarliestDate && priceDate !== p.PriceHistorySorted[0]));
      
      if(priceHistorySortedAndFiltered.length !== 0 ){
  
        let oldestPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]]; 
        p.ComparingPrice = oldestPrice;
        p.SortingDiscount = (p.LatestPrice/oldestPrice*100);
        p.Discount = (p.SortingDiscount - 100).toFixed(1);
      }else{
        p.SortingDiscount = 100;
      }

      if(p.SubType && p.SubType.includes("Brennevin,") ){
        p.SubType = "Brennevin";
      }
      if(p.SubType && p.SubType.includes("Sterkvin, annen")){
        p.SubType = "Sterkvin";
      }
      if(p.SubType == undefined){
        p.SubType = p.Type;
      }
      if(p.Stock === undefined){
        p.Stock = {
          Stores: []
        };
      }
      if(p.Stock.Stores === undefined){
        p.Stock.stock = p.Stock.Stock
        delete p.Stock.Stock;
        p.Stock.Stores = [];
      }
    });

    return res.send(matchingProducts.splice(0,20));
  }
});
exports.StockUpdateListener = functions.region('europe-west1').runWith(runtimeOpts).database.ref("/StocksToBeFetched/")
    .onWrite(async (change, context) => {

        // Exit when the data is deleted.
        if (!change.after.exists()) {
          return null;
        }
      
      const newValue = change.after.val();

      const count = newValue.length > 500 ? 500 : newValue.length;
      console.log(newValue.length);
      for (let i = 0; i < count  ; i++) {
        if(newValue[i] !== undefined){
          newValue[i].Stores = await VmpClient.FetchStoreStock(newValue[i].productId);
            await FirebaseClient.UpdateProductStock(newValue[i]);
        }
        newValue.splice(i, 1);
      }

    return await FirebaseClient.SetStockUpdateList(newValue);
    });

    exports.ProductUpdateListener = functions.region('europe-west1').runWith(runtimeOpts).database.ref("/ProductsToBeUpdated/")
    .onWrite(async (change, context) => {
        // Exit when the data is deleted.
        if (!change.after.exists()) {
        return null;
      }
      var remainingProducts = change.after.val();

      var updatedProducts = remainingProducts.splice(0, remainingProducts.length > 1000 ? 1000 : remainingProducts.length);
      await FirebaseClient.UpdateProductPrices(updatedProducts);

      return await FirebaseClient.SetProductUpdateList(remainingProducts);
    });