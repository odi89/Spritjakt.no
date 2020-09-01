const functions = require("firebase-functions");
const FirebaseClient = require("./datahandlers/firebaseClient");
const VmpClient = require("./datahandlers/vmpClient");
const EmailClient = require("./datahandlers/emailClient");
const firebaseAdmin = require("firebase-admin");
const serviceAccount = require("./configs/serviceAccountKey.json");
const rp = require("request-promise");
const SortArray = require("sort-array");
const { user } = require("firebase-functions/lib/providers/auth");


// Initialize the app with a service account, granting admin privileges
firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: "https://spritjakt.firebaseio.com/",
});
const td = new Date();
const allowedTimeSpans = {
    "7days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 7),
    "14days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 14),
    "30days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 30),
    "90days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 90),
};

//init();
async function init() {
    await firebaseAdmin.firestore().collection("Products")
        .where("LastUpdated", ">=", allowedTimeSpans["90days"].getTime())
        .orderBy("LastUpdated")
        .get().then(async function (qs) {
            if (!qs.empty) {
                await qs.forEach(async (p) => {
                    p = p.data();

                    const productRef = firebaseAdmin.firestore().collection("Products").doc(p.Id);

                    p.PriceHistorySorted = SortArray(Object.keys(p.PriceHistory), {
                        order: "desc",
                    });

                    p.LatestPrice = p.PriceHistory[p.PriceHistorySorted[0]];

                    let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(
                        (priceDate) =>
                            priceDate <= p.LastUpdated &&
                            priceDate !== p.PriceHistorySorted[0]
                    );
                    if (priceHistorySortedAndFiltered.length > 0) {
                        let oldestPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]];
                        p.ComparingPrice = oldestPrice;
                        p.SortingDiscount = (p.LatestPrice / oldestPrice) * 100;
                    }
                    /*
                    p.PriceIsLower = false;
                    if (p.SortingDiscount < 100) {
                        p.PriceIsLower = true;
                    }*/
                    if (p.SortingDiscount >= 102 || p.SortingDiscount <= 98) {
                        p.LastUpdated = parseInt(p.PriceHistorySorted[0]);
                    } else {
                        p.LastUpdated = parseInt(p.PriceHistorySorted[1]);
                    }

                    if (p.SearchWords == undefined) {
                        p.SearchWords = p.Name.toLowerCase().split(" ");
                    }

                    delete p.SearchableName;
                    delete p.Discount;

                    p = FirebaseClient.PrepProduct(p);
                    try {
                        await productRef.set(p);
                    } catch (e) {
                        console.log(e)
                    }
                    console.log(p.Id);

                });
            }
            console.log("Done");
        });
}

mail()
async function mail() {
    let d = new Date("2020-08-31");
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    let products = await FirebaseClient.GetProductsOnSale(d.getTime());

    if (products === undefined || products.length === 0) {
        return;
    }

    SortArray(products, {
        by: "SortingDiscount",
        order: "asc"
    });

    let usedCategories = [];
    var newsLetterProducts = [];
    await products.map(async p => {
        let pp = await FirebaseClient.PrepProduct(p);

        if (products.length < 9) {
            newsLetterProducts.push(pp);
        } else {
            if (newsLetterProducts.length < 9 && !usedCategories.includes(pp.SubType)) {
                newsLetterProducts.push(pp);
                usedCategories.push(pp.SubType);
            }
        }
    });

    var emailClient = new EmailClient(newsLetterProducts, ["matslovstrandberntsen@gmail.com"]);
    await emailClient.SendEmails();
}