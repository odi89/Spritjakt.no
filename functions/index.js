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
    await FirebaseClient.SetProductUpdateList( await VmpClient.FetchFreshProducts());
});

exports.updateStocks = functions.region('europe-west1').runWith(runtimeOpts).pubsub.schedule('15 8 * * *').timeZone("Europe/Paris").onRun(async (context) => {
  await FirebaseClient.SetStockUpdateList( await VmpClient.FetchFreshStocks());
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

exports.productSearch = functions.region('europe-west1').runWith(runtimeOpts).https.onRequest(async (req, res) => {

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
    searchString = req.query.searchString.toLowerCase().replace(/[^a-z0-9]/gi,'');
    var products = await FirebaseClient.ProductSearchFireStore(searchString);
    
    let preppedProducts = [];
    Object.keys(products).forEach(id => {
      let p = products[id];
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
      if(p.SearchableName.includes(req.query.searchString.trim())){
        preppedProducts.push(p);
      }
      
    });
    return res.send(preppedProducts);
  }
});

exports.StockUpdateListener = functions.region('europe-west1').runWith(runtimeOpts).database.ref("/StocksToBeFetched/")
    .onWrite(async (change, context) => {

        // Exit when the data is deleted.
        if (!change.after.exists()) {
          return null;
        }
      
      const newValue = change.after.val();
      const previousValue = change.before.val();

      if ( newValue ===  previousValue) {
        return null;
      }

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