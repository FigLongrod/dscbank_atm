import {ATM} from './atm.js';
import {Wallet} from './wallet.js';

console.log("App Initialising");

let atm = new ATM(
    document.getElementById("console"),
    document.getElementById("cardreader"),
    document.getElementById("pinreader"),
    document.getElementById("dispenser"),
    document.getElementById("printer")
);
let wallet = new Wallet(document.getElementById("cards"), document.getElementById("cash"), atm.cardreader, atm.cashreader);
wallet.init().then(() => wallet.draw());
atm.init();