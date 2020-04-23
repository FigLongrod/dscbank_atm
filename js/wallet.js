import { Tools, Sounds } from './tools.js';

class Cash {
    constructor(cashElement, cashReader) {
        this.element = cashElement;
        this.reader = cashReader;
        this.notes = {}
        Tools.addEventHandler(document, "insert-enabled", () => this.allowInsert = true, this);
        Tools.addEventHandler(document, "insert-disabled", () => this.allowInsert = false, this);
    }
    addNote(note) {
        this.notes[note]++;
    }
    init() {
        this.notes = {
            "100": Math.floor(Math.random() * 5),
            "50": Math.floor(Math.random() * 5),
            "20": Math.floor(Math.random() * 6),
            "10": Math.floor(Math.random() * 10),
            "5": Math.floor(Math.random() * 10),
            "2": Math.floor(Math.random() * 4),
            "1": Math.floor(Math.random() * 20)
        };
    }
    draw() {
        this.element.innerHTML = "";
        let z = 2;
        let offs = 80;
        let rot = -10;
        ["100", "50", "20", "10", "5", "2", "1"].forEach(note => {
            for (let i = 0; i < this.notes[note]; i++) {
                let div = document.createElement("div");
                div.className = "note note-" + note;
                div.style.zIndex = z++;
                div.style.top = `${offs}px`;
                div.style.transform = `translate(${(Math.random() * 4) - 2}px,${(Math.random() * 4) - 2}px) rotate(${(Math.random() * 4) - 2 + rot}deg)`;
                Tools.addEventHandler(div, "click", () => {
                    if (this.allowInsert) {
                        this.notes[note]--;
                        document.dispatchEvent(new CustomEvent("insert-note", {detail: note}));
                        div.remove();
                    }
                }, this);
                this.element.appendChild(div);
            }
            rot += 8;
            //offs += 40;
        });
    }
}
class Cards {
    constructor(element, cardreader) {
        this.element = element;
        this.cardreader = cardreader;
        this.cards = [];
        Tools.addEventHandler(document, "add-card", e => {
            this.cards.push(e.detail);
            this.draw();
        })
        Tools.addEventHandler(document, "remove-card", e => {
            let index = this.cards.indexOf(e.detail);
            if (index >= 0) {
                this.cards.splice(index, 1);
                this.draw();
            }
        })
    }
    init() {
        return new Promise((resolve, reject) => {
            Tools.fetchJSONFile("json/accounts.json").then(data => {
                this.cards = data.map(m => ({
                    id: m.id,
                    name: m.title + " " + m.firstName + " " + m.lastName,
                    cardNumber: m.cardNumber
                }));
                Tools.addEventHandler(document, "capture", e => {
                    let card = this.cards.filter(c => c.cardNumber == e.detail);
                    if (card.length > 0) {
                        let element = document.getElementById("card-" + card[0].id);
                        element.parentNode.removeChild(element);
                    }
                });
                resolve(this);
            }, reject);
        });
    }
    draw() {
        this.element.innerHTML = "";
        this.cards.forEach((c, i) => {
            let card = document.createElement("div");
            card.className = "card";
            card.id = "card-" + c.id;
            card.style.zIndex = i + 2;
            card.style.top = `${80 + (20 * i)}px`;
            card.style.transform = `translate(${(Math.random() * 6) - 3}px,${(Math.random() * 6) - 3}px) rotate(${(Math.random() * 6) - 3}deg)`;
            card.innerHTML =
                `<img class='card-logo' src='media/images/daytona.gif'/><img class='card-vasi' src='media/images/vasi.png'/><img class='card-chip' src='media/images/chip.png'/><h3>${c.cardNumber}</h3><h4>${c.name}</h4>`;
            this.element.appendChild(card);
            Tools.addEventHandler(
                document.getElementById(card.id),
                "click",
                () => {
                    this.cardreader.insertCard(c);
                },
                this
            );
        });
    }
}

export class Wallet {
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