const SortArray = require('sort-array');
const firebase = require('firebase-admin');


module.exports = class FirebaseClient{

    static async SaveProductsInBulk(UpdatedProducts){
    
    var time = await firebase.database().ref('/lastProductWriteTime').once('value').then(snapshot => {return snapshot.val()});    

    let productRef = firebase.database().ref('/Products');
    await productRef.transaction( function(StoredProducts){
        let d = new Date();
        d.setDate(d.getDate()-1);
        d.setHours(22);
        d.setMinutes(0);
        d.setSeconds(0);
        d.setMilliseconds(0);
        var today = d.getTime();
        
        if(StoredProducts){        
            UpdatedProducts.forEach(p => {
                let sp = StoredProducts[p.Id];
                sp.SearchableName = p.SearchableName;

                if(sp === undefined){
                    p.PriceHistory = {[today]: p.CurrentPrice};                    
                    delete p.CurrentPrice;
                    StoredProducts[p.Id] = p; 
                }else{
                delete sp.PriceHistory[d];
                let LatestPrice = p.CurrentPrice;
                    
                let priceHistorySorted = SortArray(Object.keys(sp.PriceHistory), {order: "desc"});

                if(priceHistorySorted.length !== 0){
                    StoredProducts[p.Id] = sp;

                    let comparativeBasePriceDate = priceHistorySorted[0]; 

                    //Only updating LastUpdate if there has been an actual pricechange
                    if(StoredProducts[p.Id].PriceHistory[comparativeBasePriceDate] !== LatestPrice){
                        StoredProducts[p.Id].LastUpdated = p.LastUpdated;
                        sp.PriceHistory[today] = p.CurrentPrice;
                    }
                }
                }
            });
        }
        return StoredProducts;
      });
        await this.UpdateWriteTime(UpdatedProducts.length, time);
    }

    static async FetchOnSaleProducts(BasePriceTime){
        return firebase.database().ref('/Products').orderByChild("LastUpdated").startAt(BasePriceTime).once('value').then(function(snapshot) {
            return snapshot.val();
          });
    }

    static async ProductSearch(searchString){
        return firebase.database().ref('/Products').orderByChild("SearchableName").startAt(searchString).limitToFirst(10).once('value').then(function(snapshot) {
            return snapshot.val();
          });
    }


    static async FetchLastWriteTime(){
        return firebase.database().ref('/lastProductWriteTime').once('value').then(function(snapshot) {
            return snapshot.val();
          });
    }

    static async UpdateWriteTime(numberOfProducts, time){

        //Setting a cutoff for when a price-change is no longer considered a deal
        if(time.BasePriceTime < Date.now() - 60 * 60 * 1000 * 24 * 30){
            time.BasePriceTime = Date.now();
        }
        let now = new Date();
        var lastWriteTime =  {
            BasePriceTime : time.BasePriceTime,
            UpdateFetchTime : now.toLocaleString(),
            ProductsUpdated: numberOfProducts
        }
        let timeRef = firebase.database().ref('/lastProductWriteTime');
        timeRef.set(lastWriteTime);

    }

    static async UpdateStock(Stocks){

        let productRef = firebase.database().ref('/Products');
        await productRef.transaction( function(StoredProducts){

            if(StoredProducts){        
                Stocks.forEach(s => {

                    let id = s.ProductId;
                    delete s.ProductId;
                    if(StoredProducts[id]){
                        StoredProducts[id].Stock = s;
                    }
                });
            }
            return StoredProducts;
          });
    }    
}

