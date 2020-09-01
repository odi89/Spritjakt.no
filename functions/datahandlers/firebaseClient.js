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

        sp.priceHistorySorted = SortArray(Object.keys(sp.PriceHistory), {
          order: "desc",
        });

        p.LatestPrice = p.CurrentPrice;
        sp.ComparingPrice = p.PriceHistory[sp.priceHistorySorted[0]];

        sp.SortingDiscount = (sp.LatestPrice / sp.ComparingPrice) * 100;
        sp.PriceHistory[today] = sp.CurrentPrice;

        if (p.SortingDiscount <= 99 || p.SortingDiscount >= 101) {
          sp.LastUpdated = p.LastUpdated;
        }
      }
      try {
        await productRef.update(this.PrepProduct(sp));
      } catch (error) {
        console.log(error);
      }
    }
  }

  static PrepProduct(p) {
    if (p.SubType && p.SubType.includes("Brennevin,")) {
      p.SubType = "Brennevin";
    }
    if (p.SubType && p.SubType.includes("Sterkvin, annen")) {
      p.SubType = "Sterkvin";
    }
    if (p.SubType && p.SubType.includes("Alkoholfri")) {
      p.SubType = "Alkoholfritt";
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

  static async ProductSearchAdvanced(searchStrings) {
    let productRef = firebase
      .firestore()
      .collection("Products")
      .where("SearchWords", "array-contains-any", searchStrings)
      .orderBy("Name");
    let snapshot = await productRef.get();
    let products = [];
    if (!snapshot.empty) {
      snapshot.forEach((p) => {
        products.push(p.data());
        console.log(p.Id);
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

  static async GetProductsOnSale(lastUpdated) {
    let products = [];
    await firebase.firestore()
      .collection("Products")
      .where("LastUpdated", ">=", lastUpdated)
      .orderBy("LastUpdated")
      .get().then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            products.push(p.data());
          });
        }
      });
    return products;
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
    await firebase.firestore().collection("Users")
      .get()
      .then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
          let user = doc.data();
          emails.push(user.Email);
        });
      })
      .catch(function (error) {
        console.log("Error getting emails: ", error);
      });
    return emails;
  }

  static async RegisterUser(email) {
    let result = false;
    await firebase.firestore().collection("Users").add({
      Email: email
    })
      .then(function (docRef) {
        console.log("email added with ID: ", docRef.id);
        result = true;
      })
      .catch(function (error) {
        console.error("could not add email: ", error);
      });
    return result;
  }

  static async RemoveUser(email) {
    var result = true;
    var id = ""
    await firebase.firestore().collection("Users").where("Email", "==", email)
      .get()
      .then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
          id = doc.id;
        })
      }).catch(error => {
        console.log("Error removing user: ", error);
        result = false;
      });

    await firebase.firestore().collection("Users").doc(id).delete()
      .catch(error => {
        console.log("Error removing user: ", error);
        result = false;
      });
    return result;
  }

};