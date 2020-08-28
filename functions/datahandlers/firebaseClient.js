const SortArray = require("sort-array");
const firebase = require("firebase-admin");
require("firebase/firestore");
const allTimeEarliestDate = new Date(1594166400000);

module.exports = class FirebaseClient {

  static async UpdateProductPrices(updatedProducts) {
    let d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(22);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);

    var today = d.getTime();

    console.log("Products to update: " + updatedProducts.length);

    this.UpdateWriteTime(updatedProducts.length);

    var newsLetterProducts = [];

    for (let i = 0; i < updatedProducts.length; i++) {
      const p = updatedProducts[i];

      const productRef = firebase.firestore().collection("Products").doc(p.Id);
      const productDoc = await productRef.get();
      let sp = productDoc.data();
      if (sp === undefined) {
        p.PriceHistory = {
          [today]: p.CurrentPrice,
        };
        delete p.CurrentPrice;
        p.LastUpdated = allTimeEarliestDate.getTime() - 1000;
        sp = p;

      } else {
        sp.ProductStatusSaleName = p.ProductStatusSaleName;
        sp.SearchWords = p.SearchWords;
        sp.Description = p.Description;
        delete sp.PriceHistory[today];
        let LatestPrice = p.CurrentPrice;
        let priceHistorySorted = SortArray(Object.keys(sp.PriceHistory), {
          order: "desc",
        });

        if (priceHistorySorted.length !== 0) {
          let comparativeBasePriceDate = priceHistorySorted[0];
          //Only updating LastUpdate if there has been an actual pricechange
          if (sp.PriceHistory[comparativeBasePriceDate] !== LatestPrice) {
            sp.LastUpdated = p.LastUpdated;
            sp.PriceHistory[today] = p.CurrentPrice;
            newsLetterProducts.push(this.PrepProduct(sp));
          }
        }
      }
      try {
        await productRef.update(sp);
      } catch (error) {
        console.log(error);
      }
    }
    this.SetNewsLetterProducts(newsLetterProducts);
  }

  static PrepProduct(p) {
    if (p.SubType && p.SubType.includes("Brennevin,")) {
      p.SubType = "Brennevin";
    }
    if (p.SubType && p.SubType.includes("Sterkvin, annen")) {
      p.SubType = "Sterkvin";
    }
    if (p.SubType == undefined) {
      p.SubType = p.Type;
    }

    if (p.Stock === undefined) {
      p.Stock = {
        Stores: [],
      };
    }
    if (p.Stock.Stores === undefined) {
      p.Stock.stock = p.Stock.Stock;
      delete p.Stock.Stock;
      p.Stock.Stores = [];
    }
    return p;
  }

  static async FetchOnSaleProductsFireStore(UpdateTime) {
    let productRef = firebase
      .firestore()
      .collection("Products")
      .where("LastUpdated", ">=", UpdateTime)
      .orderBy("LastUpdated");
    let snapshot = await productRef.get();
    let products = [];
    if (!snapshot.empty) {
      snapshot.forEach((p) => {
        p = p.data();

        p.PriceHistorySorted = SortArray(Object.keys(p.PriceHistory), {
          order: "desc",
        });

        if (p.PriceHistorySorted.length === 1) {
          return;
        }

        p.LatestPrice = p.PriceHistory[p.PriceHistorySorted[0]];

        let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(
          (priceDate) =>
            priceDate <= UpdateTime &&
            priceDate !== p.PriceHistorySorted[0]
        );

        if (priceHistorySortedAndFiltered.length === 0) {
          return;
        }

        let oldestPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]];
        p.ComparingPrice = oldestPrice;
        p.SortingDiscount = (p.LatestPrice / oldestPrice) * 100;
        p.Discount = (p.SortingDiscount - 100).toFixed(1);

        if (p.SortingDiscount !== 100) {
          p = this.PrepProduct(p);
          products.push(p);
        }

      });
    }
    return products;
  }

  static async ProductSearchAdvanced(searchStrings) {
    let productRef = firebase
      .firestore()
      .collection("Products")
      .where("SearchWords", "array-contains-any", searchStrings)
      .orderBy("SearchableName");
    let snapshot = await productRef.get();
    let products = [];
    if (!snapshot.empty) {
      snapshot.forEach((p) => {
        products.push(p.data());
      });
    }
    return products;
  }

  static async FetchLastWriteTime() {
    return firebase
      .database()
      .ref("/lastProductWriteTime")
      .once("value")
      .then(function (snapshot) {
        return snapshot.val();
      });
  }

  static async UpdateWriteTime(numberOfProducts) {
    let now = new Date();
    var lastWriteTime = {
      UpdateFetchTime: now.toLocaleString(),
      ProductsUpdated: numberOfProducts,
    };
    let timeRef = firebase.database().ref("/lastProductWriteTime");
    timeRef.set(lastWriteTime);
  }

  static async SetStockUpdateList(Stocks, addOnSaleProductsIfMissing = false) {
    if (addOnSaleProductsIfMissing) {
      var products = await this.FetchOnSaleProductsFireStore(
        allTimeEarliestDate.getTime() + 90000000
      );
      products.map((p) => {
        if (!Stocks.find((s) => s.productId === p.Id)) {
          Stocks.unshift({ productId: p.Id });
        }
      });
    }
    firebase.database().ref("/StocksToBeFetched/").set(Stocks);
  }

  static async UpdateProductStock(stock) {
    const productRef = firebase
      .firestore()
      .collection("Products")
      .doc(stock.productId);
    try {
      console.log("Updating Stock " + stock.productId);
      delete stock.productId;
      delete stock.stock;
      await productRef.update({ Stock: stock });
    } catch (e) {
      console.log("Product not in database");
    }
  }

  static async UpdateStores(stores) {
    const storesRef = firebase.firestore().collection("Stores").doc("1");
    storesRef.set({ StoreList: stores });
  }

  static async GetStores() {
    const storesRef = firebase.firestore().collection("Stores").doc("1");
    let storeObject = storesRef.get();
    storeObject = (await storeObject).data();
    return storeObject.StoreList;
  }

  static async GetEmails() {

    var emails = [];
    firebase.firestore().collection("Emails")
      .get()
      .then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
          emails.push(doc.data());
        });
      })
      .catch(function (error) {
        console.log("Error getting emails: ", error);
      });
    return emails;
  }

  static async RegisterEmail(email) {

    firebase.firestore().collection("Emails").add(email)
      .then(function (docRef) {
        console.log("email added with ID: ", docRef.id);
        return true;
      })
      .catch(function (error) {
        console.error("could not add email: ", error);
        return false;
      });
  }

  static async RemoveEmail(email) {
  }

  static async SetNewsLetterProducts(products = []) {
    firebase.database().ref("/NewsLetterProducts/").set(products);
  }
};