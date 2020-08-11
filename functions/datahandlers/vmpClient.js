const rp = require( 'request-promise');
const config = require( '../configs/vmp.json');
const vmpOptions = {
    uri: config.url,
    headers: {
        'User-Agent': 'Request-Promise',
        'Ocp-Apim-Subscription-Key': config.apiKey
    },
    json: true // Automatically parses the JSON string in the response
};
module.exports = {

    FetchFreshProducts: async () => {
        var today = new Date();
        let options = vmpOptions;
        options.uri += "details-normal";
        options.qs = {
            maxResults: 50000,
            changedSince: today.toISOString().slice(0,10)
        };
        console.info(options);
        return await rp(options)
        .then(function (res) {
            var raw = res.filter( function (p) {
                return p.classification.mainProductTypeId !== "8" && p.prices[0] !== undefined // Gaveartikler og tilbehør
            });
            var items = [];
            
            raw.map( p => (
                 items.push(new Product(p))
            ));
            
            console.info("Fetched products " + items.length + " from Vinmonopolet");
            return items;
        })
        .catch(function (err) {
            console.error("vmp fetch failed: " + err);
        });
    },
    FetchFreshStocks: async () => {
        var today = new Date();
        let options = vmpOptions;
        options.uri += "accumulated-stock";
        options.qs = {
            maxResults: 50000,
            changedSince: today.toISOString().slice(0,10)
        };
        return await rp(options)
        .then(function (res) {
            var items = [];
            res.map( p => (
                 items.push(new Stock(p))
            ));
            
            console.info("Fetched stock");
            return items;
        })
        .catch(function (err) {
            console.error("vmp fetch failed: " + err);
        });
    }
}

class Product{

    constructor(rawProduct){

        let d = new Date();
        d.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());

        this.LastUpdated = d.getTime();
        this.Id = rawProduct.basic.productId;
        this.Name = rawProduct.basic.productLongName;
        this.SearchableName = rawProduct.basic.productLongName.toLowerCase().replace(" ","");
        this.Volume = rawProduct.basic.volume;
        this.Alcohol = rawProduct.basic.alcoholContent;
        this.Country = rawProduct.origins.origin.country;
        this.Type = rawProduct.classification.mainProductTypeName;
        this.SubType = rawProduct.classification.subProductTypeName;

        this.CurrentPrice = rawProduct.prices[0].salesPrice;
    }
}
class Stock{
    constructor(rawPrice){
        this.ProductId = rawPrice.productId;
        this.Stock = rawPrice.stock;
        this.StoresWithStock = rawPrice.numberOfStoresWithStock;
    }
}
