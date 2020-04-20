import {ATM} from '/js/atm.js';
import {Cards} from '/js/cards.js';

let atm = new ATM(
    document.getElementById("console"),
    document.getElementById("cardreader"),
    document.getElementById("pinreader"),
    document.getElementById("dispenser")
);
let cards = new Cards(document.getElementById("cards"), atm.cardreader);
cards.init().then(() => cards.draw());