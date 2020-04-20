import {ATM} from './atm.js';
import {Cards} from './cards.js';

console.log("App Initialising");

let atm = new ATM(
    document.getElementById("console"),
    document.getElementById("cardreader"),
    document.getElementById("pinreader"),
    document.getElementById("dispenser")
);
let cards = new Cards(document.getElementById("cards"), atm.cardreader);
cards.init().then(() => cards.draw());