import rp from 'request-promise';

class SpritjaktClient{
    
    static async FetchProducts(timeSpan){

        let options =  {
            uri : "https://europe-west1-spritjakt.cloudfunctions.net/GetOnSaleProductsHttp",
            qs:{
               timeSpan: timeSpan,
               firestore: true
            },
            json: true
        }
        let res = await rp(options)
        .then(function (res) {
            return res;
        })
        .catch(function (err) {
            console.log(err);
        });
        
        return res.products;
    }
    static async SearchProducts(searchString){

        let options =  {
            uri : "https://europe-west1-spritjakt.cloudfunctions.net/productSearch",
            qs:{
                searchString: searchString
            },
            json: true
        }
        let res = await rp(options)
        .then(function (res) {

            return res === undefined ? [] : res;
        })
        .catch(function (err) {
            console.log(err);
        });
        return res;
    }
}

export default SpritjaktClient;