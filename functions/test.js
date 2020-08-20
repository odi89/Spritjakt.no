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
init();
async function init(){

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
      await FirebaseClient.SetStockUpdateList(freshStocks, true);
    }
}
return;