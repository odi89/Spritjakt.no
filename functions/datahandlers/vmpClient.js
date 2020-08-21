const rp = require("request-promise");
const config = require("../configs/vmp.json");
const vmpOptions = () => {
  return {
    uri: config.url,
    headers: {
      "User-Agent": "Request-Promise",
      "Ocp-Apim-Subscription-Key": config.apiKey,
    },
    json: true, // Automatically parses the JSON string in the response
  };
};
class VmpClient {
  static async FetchFreshProducts() {
    var today = new Date();
    let options = vmpOptions();
    options.uri += "details-normal";
    options.qs = {
      changedSince: today.toISOString().slice(0, 10),
      maxResults: 30000,
    };
    console.info(options);
    return await rp(options)
      .then(function (res) {
        var raw = res.filter(function (p) {
          return (
            p.classification.mainProductTypeId !== "8" &&
            p.prices[0] !== undefined
          ); // Gaveartikler og tilbehør
        });
        var items = [];

        raw.map((p) => items.push(new Product(p)));

        console.info("Fetched products " + items.length + " from Vinmonopolet");
        return items;
      })
      .catch(function (err) {
        console.error("vmp fetch failed: " + err);
      });
  }
  static async FetchFreshStocks(start) {
    var today = new Date();
    let options = vmpOptions();

    options.uri += "accumulated-stock";
    options.resolveWithFullResponse = true;
    options.qs = {
      maxResults: 5000,
      changedSince: today.toISOString().slice(0, 10),
      start: start,
    };
    return await rp(options)
      .then(function (res) {
        var items = [];
        for (let i = 0; i < res.body.length; i++) {
          const p = res.body[i];
          delete p.numberOfStoresWithStock;
          delete p.updatedDate;
          delete p.updatedTime;
          items.push(p);
        }
        return {
          totalCount: parseInt(res.headers["x-total-count"]),
          stocks: items,
        };
      })
      .catch(function (err) {
        console.error("vmp fetch failed: " + err);
        return { totalCount: 0, stocks: [] };
      });
  }
  static async FetchStoreStock(productId) {
    let options = {
      uri: "https://www.vinmonopolet.no/api/products/" + productId + "/stock",
      qs: {
        pageSize: 1000,
        currentPage: 0,
        fields: "BASIC",
        latitude: 50.3,
        longitude: 10.2,
      },
      jar: true,
      json: true,
    };
    return await rp(options)
      .then(function (res) {
        return res === undefined ? [] : res.stores;
      })
      .catch(function (err) {
        console.error("Store stock fetch failed: " + err);
      });
  }
}

class Product {
  constructor(rawProduct) {
    let d = new Date();
    d.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());

    this.LastUpdated = d.getTime();
    this.Id = rawProduct.basic.productId;
    this.Name = rawProduct.basic.productLongName;
    this.SearchableName = rawProduct.basic.productLongName
      .toLowerCase()
      .replace(/[^a-z0-9]/gi, "");
    this.Volume = rawProduct.basic.volume;
    this.Alcohol = rawProduct.basic.alcoholContent;
    this.Country = rawProduct.origins.origin.country;
    this.Type = rawProduct.classification.mainProductTypeName;
    this.SubType = rawProduct.classification.subProductTypeName;
    this.Description = rawProduct.description;
    this.CurrentPrice = rawProduct.prices[0].salesPrice;
    this.SearchWords = rawProduct.basic.productLongName
      .toLowerCase()
      .split(" ");
  }
}

module.exports = VmpClient;
