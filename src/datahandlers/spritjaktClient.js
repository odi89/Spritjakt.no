import rp from "request-promise";

class SpritjaktClient {
  static async FetchProducts(timeSpan) {
    let options = {
      uri:
        "https://europe-west1-spritjakt.cloudfunctions.net/getOnSaleProductsHttp",
      qs: {
        timeSpan: timeSpan,
      },
      json: true,
    };
    let res = await rp(options)
      .then(function (res) {
        return res;
      })
      .catch(function (err) {
        console.log(err);
      });

    return res === undefined ? [] : res.products;
  }
  static async SearchProducts(searchString) {
    let options = {
      uri:
        "https://europe-west1-spritjakt.cloudfunctions.net/productSearchAdvanced",
      qs: {
        searchString: searchString,
      },
      json: true,
    };
    let res = await rp(options)
      .then(function (res) {
        return res;
      })
      .catch(function (err) {
        console.log(err);
      });
    return res === undefined ? [] : res;
  }
  static async FetchStores() {
    let options = {
      uri: "https://europe-west1-spritjakt.cloudfunctions.net/getStoresHttp",
      json: true,
    };
    let res = await rp(options)
      .then(function (res) {
        return res;
      })
      .catch(function (err) {
        console.log(err);
      });
    return res === undefined ? [] : res;
  }
}

export default SpritjaktClient;
