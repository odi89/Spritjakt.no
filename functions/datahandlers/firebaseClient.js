const SortArray = require('sort-array');
const firebase = require('firebase-admin');
require("firebase/firestore");
const VmpClient = require( "./vmpClient");
const allTimeEarliestDate = new Date(1594166400000);

module.exports = class FirebaseClient{

    static async UpdateProductPrices(updatedProducts){

        let d = new Date();
        d.setDate(d.getDate()-1);
        d.setHours(22);
        d.setMinutes(0);
        d.setSeconds(0);
        d.setMilliseconds(0);
        var today = d.getTime();

        this.UpdateWriteTime(updatedProducts.length);
        for (let i = 0; i < updatedProducts.length; i++) {

            const p = updatedProducts[i];

            const productRef = firebase.firestore().collection('Products').doc(p.Id);
            const productDoc = await productRef.get();
            let sp = productDoc.data();            
            if(sp === undefined){
                p.PriceHistory = {[today]: p.CurrentPrice};                    
                delete p.CurrentPrice;
                p.LastUpdated = allTimeEarliestDate.getTime() - 1000;
                sp = p;
                continue;
            }
            delete sp.PriceHistory[today];
            let LatestPrice = p.CurrentPrice;
            let priceHistorySorted = SortArray(Object.keys(sp.PriceHistory), {order: "desc"});

            if(priceHistorySorted.length !== 0){
                
                let comparativeBasePriceDate = priceHistorySorted[0]; 
                //Only updating LastUpdate if there has been an actual pricechange
                if(sp.PriceHistory[comparativeBasePriceDate] !== LatestPrice){
                    sp.LastUpdated = p.LastUpdated;
                    sp.PriceHistory[today] = p.CurrentPrice;
                }
            }
            sp.SearchableName = p.SearchableName;
            sp.Description = p.Description;
            await productRef.update(sp);
        }
        console.log(updatedProducts.length);
    }

    static async FetchOnSaleProductsFireStore(UpdateTime){
        let productRef = firebase.firestore().collection('Products').where('LastUpdated', '>=', UpdateTime).orderBy('LastUpdated');
        let snapshot =  await productRef.get();
        let products = [];
        if (!snapshot.empty) {
            snapshot.forEach(p => {       
                products.push(p.data());
            });
        }
        return products;
    }

    static async ProductSearchFireStore(searchString){
        console.log(searchString);
        let productRef = firebase.firestore().collection('Products').where('SearchableName', '>=', searchString).orderBy('SearchableName').limit(20);
        let snapshot =  await productRef.get();
        let products = [];
        if (!snapshot.empty) {
            snapshot.forEach(p => {       
                products.push(p.data());
            });
        }
        return products;
    }

    static async FetchLastWriteTime(){
        return firebase.database().ref('/lastProductWriteTime').once('value').then(function(snapshot) {
            return snapshot.val();
          });
    }

    static async UpdateWriteTime(numberOfProducts){        
        let now = new Date();
        var lastWriteTime =  {
            UpdateFetchTime : now.toLocaleString(),
            ProductsUpdated: numberOfProducts
        }
        let timeRef = firebase.database().ref('/lastProductWriteTime');
        timeRef.set(lastWriteTime);

    }

    static async SetStockUpdateList(Stocks){
        firebase.database().ref("/StocksToBeFetched/").set(Stocks);
    }

    static async SetProductUpdateList(Products){
        firebase.database().ref("/ProductsToBeUpdated/").set(Products);
    }
    
    static async UpdateProductStock(stock){
        const productRef = firebase.firestore().collection('Products').doc(stock.productId);
        console.log("Updating Stock " + stock.productId);
        await productRef.update({
            Stock: stock
        }).catch();

    }        
}


