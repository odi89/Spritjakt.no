const nodemailer = require("nodemailer");
const emailAuth = require("../configs/emailAuth.json");
const fs = require('fs');
const path = require('path');
const emailHeader = fs.readFileSync(path.resolve(__dirname, "./templates/header.txt"), 'utf8');
const emailFooter = fs.readFileSync(path.resolve(__dirname, "./templates/footer.txt"), 'utf8');
const emailProductItem = fs.readFileSync(path.resolve(__dirname, "./templates/productItem.txt"), 'utf8');

const greetings = ["Halla Balla!", "Hei Sveis!", "Sjallabais sjef!", "God dag mann, økseskaft!", "Hallo i luken!", "Heisann Sveisann!", "G'day mate!", "Tittei, her er jeg!"];

module.exports = class EmailClient {

    constructor(products, recipients) {

        this.products = products;
        this.recipients = recipients;

        this.transporter = nodemailer.createTransport(emailAuth);
        this.options = {
            from: {
                name: "Spritjakt.no",
                address: 'varsel@spritjakt.no'
            },
            to: '**Is set later**',
            subject: 'Nyhetsbrev - Skulle du sett, i dag har jeg noen godsaker til deg!',
            html: this.CreateNewsLetterEmail()
        };
    }
    CreateNewsLetterEmail() {
        var html = emailHeader.replace(/&Header&/g, greetings[Math.floor(Math.random() * greetings.length)]);
        let subheader = "Jeg bare titter innom for å fortelle deg at det er nye varer som har fått redusert pris i dag.";
        if (this.products.length == 9) {
            subheader += "<br />Her er et utdrag av de beste tilbudene.";
        }
        html = html.replace(/&SubHeader&/g, subheader);

        for (const i in this.products) {
            const product = this.products[i];
            var productItem = emailProductItem;
            productItem = productItem.replace(/&ProductTitle&/g, product.Name);
            productItem = productItem.replace(/&NewPrice&/g, product.LatestPrice);
            productItem = productItem.replace(/&OldPrice&/g, product.ComparingPrice);
            productItem = productItem.replace(/&Discount&/g, (product.SortingDiscount - 100).toFixed(1));
            productItem = productItem.replace(/&ProductImageLink&/g, "https://bilder.vinmonopolet.no/cache/100x100/" + product.Id + "-1.jpg");
            productItem = productItem.replace(/&ProductLink&/g, "https://www.vinmonopolet.no/p/" + product.Id);

            productItem = productItem.replace(/&ProductDescription&/g, product.SubType);
            html += productItem;
        }

        return html;
    }

    SendEmails() {

        this.recipients.forEach(recipient => {
            var mail = this.options;
            mail.to = recipient;
            let footer = emailFooter;
            mail.html += footer.replace(/&SignOffURL&/g, "https://europe-west1-spritjakt.cloudfunctions.net/removeEmailHttp?email=" + recipient);
            this.transporter.sendMail(mail, function (error, info) {
                if (error) {
                    console.log(error);
                }
                console.log('Email sent: ' + info.response);
            });
        });
    }
}

