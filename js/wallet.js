import {Tools, Sounds} from './tools.js';
import {Cards} from './cards.js';

class Cash{
    constructor(cashElement, cashReader){
        this.element = cashElement;
        this.reader = cashReader;
        this.notes = {}
    }
    addNote(note) {
        this.notes[note]++;
    }
    init() {
        this.notes = {
            "100": Math.floor(Math.random() * 5),
            "50":  Math.floor(Math.random() * 5),
            "20":  Math.floor(Math.random() * 6),
            "10":  Math.floor(Math.random() * 10),
            "5":  Math.floor(Math.random() * 10),
            "2":  Math.floor(Math.random() * 4),
            "1":  Math.floor(Math.random() * 20)
        };
    }
    draw() {
        this.element.innerHTML = "";
        let z = 2;
        ["100","50","20","10","5","2","1"].forEach(note => {
            for (let i = 0; i < this.notes[note]; i++) {
                let div = document.createElement("div");
                div.className = "note note-" + note;
                div.style.zIndex = z++;
                div.style.transform = `translate(${(Math.random() * 6) - 3}px,${(Math.random() * 6) - 3}px) rotate(${(Math.random() * 6) - 3}deg)`;          
                this.element.appendChild(div);
            }
        });        
    }
}

class Wallet {
    constructor(cardsElement, cashElement, cardReader, cashReader) {
        this.cards = new Cards(cardsElement, cardReader);
        this.cash = new Cash(cashElement, cashReader);
    }
    async init() {
        this.cash.init();
        await this.cards.init();
    }
    draw() {
        this.cards.draw();
        this.cash.draw();
    }
}