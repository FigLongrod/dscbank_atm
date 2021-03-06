import { Tools, Sounds } from "./tools.js";

export class ATMCashDispenser {
  constructor(element, stock) {
    this.element = element;
    this.notes = stock || {
      "100": 50,
      "50": 100,
      "20": 200,
      "10": 100,
      "5": 200,
      "2": 7,
      "1": 1000
    };
  }
  async dispenseNote(note) {
    console.log(`Dispensing a $${note} note`);
    let noteDiv = document.createElement('div');
    noteDiv.className = "note note-" + note;
    noteDiv.style.left = `${8 + Math.floor(Math.random() * 8) - 4}px`;
    noteDiv.style.left = `${10 + Math.floor(Math.random() * 6) - 3}px`;
    noteDiv.style.transform = `rotate(${Math.floor(Math.random() * 5)}deg)`;
    this.element.appendChild(noteDiv);
    Tools.addEventHandler(noteDiv, "click", () => {
      Tools.play(Sounds.take_note).then(() => {
        document.dispatchEvent(new CustomEvent("add-note", {detail: note}));
        noteDiv.remove()
      });
    }, noteDiv);
    await new Promise(resolve => {
      setTimeout(resolve, 250);
    });
  }
  async issueNotes(amountRemaining, note) {
    let val = parseInt(note, 10)
    console.log(`Dispensing $${note} notes up to ${amountRemaining}`);
    return await new Promise(resolve => {
      if (this.notes[note] > 0 && amountRemaining >= val) {
        this.dispenseNote(note).then(() => {
          amountRemaining -= val;
          if (amountRemaining >= val) {
            this.issueNotes(amountRemaining, note).then(remaining => resolve(remaining));
          } else {
            resolve(amountRemaining);
          }
        });
      } else {
        resolve(amountRemaining);
      }
    });
  }
  async dispense(amount) {
    console.log(`Dispensing notes up to ${amount}`)
    await Tools.play(Sounds.dispense);
    let remaining = await this.issueNotes(amount, "100");
    remaining = await this.issueNotes(remaining, "50");
    remaining = await this.issueNotes(remaining, "20");
    remaining = await this.issueNotes(remaining, "10");
    remaining = await this.issueNotes(remaining, "5");
    remaining = await this.issueNotes(remaining, "2");
    remaining = await this.issueNotes(remaining, "1");
    if (remaining > 0) {
      throw remaining;
    }
  }
  add(notes) {
    notes.forEach(note => {
      this.notes[note]++;
    });
  }
}

export class ATMCardReader {
  constructor(element) {
    this.element = element;
    this.green = Array.from(element.children).filter(
      c => c.className == "green"
    )[0];
    this.red = Array.from(element.children).filter(
      c => c.className == "red"
    )[0];
    this.sound = document.createElement("AUDIO");
    this.element.style.cursor = "not-allowed";
    this.hasCard = false;
    this.card = null;
    this.locked = false;
  }
  async waitForCard() {
    return await new Promise(resolve => {
      let handle = setInterval(() => {
        if (this.hasCard) {
          this.red.style.display = "none";
          this.green.style.display = "block";
          clearInterval(handle);
          Tools.play(Sounds.pinbutton).then(() => resolve(this.card.cardNumber));
        }
      }, 10);
    })
  }
  async insertCard(card) {
    if (!this.hasCard) {
      this.card = card;
      this.hasCard = true;
      this.locked = true;
      document.dispatchEvent(new CustomEvent("remove-card", { detail: this.card }));
      await Tools.play(Sounds.cardreader);
    }
  }
  async ejectCard() {
    this.locked = false;
    this.element.style.cursor = "pointer";
    await Tools.play(Sounds.pinbutton);
    let handle = Tools.addEventHandler(this.element, "click", () => {
      this.element.style.cursor = "not-allowed";
      document.dispatchEvent(new CustomEvent("add-card", { detail: this.card }));
      this.card = null;
      this.hasCard = false;
      this.locked = false;
      Tools.removeEventHandler(handle);
    }, this);
  }
  async waitForTakeCard() {
    await new Promise(resolve => {
      let handle = setInterval(() => {
        if (!this.hasCard) {
          clearInterval(handle);
          this.red.style.display = "block";
          this.green.style.display = "none";
          Tools.play(Sounds.cardreader).then(resolve);
        }
      }, 10);
    });
  }
  captureCard() {
    this.card = null;
    this.hasCard = false;
    this.locked = false;
    this.red.style.display = "block";
    this.green.style.display = "none";
  }
}

export class ATMPinReader {
  constructor(element) {
    this.element = element;
    this.span = Array.from(element.children).filter(
      c => c.className == "pin"
    )[0];
    this.pin = "";
    this.span.innerHTML = "";
  }
  async waitForPIN() {
    this.pin = "";
    this.span.innerHTML = "";
    this.option = "none";

    return await new Promise((resolve, reject) => {
      let handler = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          if (e.keyCode >= 48 && e.keyCode <= 57) {
            this.pin += "" + e.keyCode - 48;
            this.span.innerHTML += "*";
            Tools.play(Sounds.pinbutton);
          } else if (e.keyCode >= 96 && e.keyCode <= 105) {
            this.pin += "" + e.keyCode - 96;
            this.span.innerHTML += "*";
            Tools.play(Sounds.pinbutton);
          } else if (e.keyCode == 13) {
            this.span.innerHTML = "";
            Tools.removeEventHandler(handler);
            resolve(this.pin);
          } else if (e.keyCode == 27) {
            this.span.innerHTML = "";
            this.pin = "";
            Tools.removeEventHandler(handler);
            reject("Canceled.");
          }
        },
        this
      );
    });
  }
}

class Receipt {
  constructor(printer, action, from, to, amount, receipt_no) {
    this.div = document.createElement("div");
    this.div.className = "receipt";
    this.printer = printer;
    this.y = 0;
    this.x = 0;
    this.rotate = 0;
    this.div.innerHTML = `<h4>${action}</h4><h5>From: ${from}</h5><h5>To: ${to}</h5><h5>Amount: ${amount.toFixed(2)}</h5><h5>Receipt No: ${receipt_no}</h5>`;
    this.div.style.transition = "transform 0.2s linear";
    let handle = Tools.addEventHandler(this.div, "click", () => {
      Tools.play(Sounds.rip, 0.25).then(() => {
        Tools.removeEventHandler(handle);
        this.div.remove(); 
      });
    });
  }
  get() {
    return this.div;
  }
  fall() {
    Tools.play(Sounds.rip, 0.25);
    let handle = setInterval(() => {
      this.y += 5;
      let oldx = this.x;
      this.x = Math.floor(Math.random() * 30) - 60;
      this.rotate = ((this.x - oldx)/60) * 15;
      this.div.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.rotate}deg)`;
      if (this.y > 400) {
        console.log('Receipt fell on the ground');
        clearInterval(handle);
        this.div.remove();
      }
    }, 20);
  }
  onScreen() {
    let bounds = this.div.getBoundingClientRect();
    if( bounds.top > window.innerHeight) {
      console.log('off screen');
     return false;
    }
    console.log('on screen');
    return true;
  }
}

export class ATMReceiptPrinter {
  constructor(element) {
    this.element = element;
    this.currentReceipt = null;
  }
  removeReceipt(receipt) {
    if (this.currentReceipt == receipt) {
      this.currentReceipt = null;
    }
  }
  getCenters(element) {
    let centerX = element.offsetLeft + element.offsetWidth / 2;
    let centerY = element.offsetTop + element.offsetHeight / 2;   
    return { x: centerX, y: centerY };
  }
  async print(action, from, to, amount, receipt_no) {
    if (this.currentReceipt) {
      this.currentReceipt.fall();
    }
    await Tools.play(Sounds.receipt, 0.5);
    await new Promise(resolve => {
      let handle = setTimeout(()  => {
        clearTimeout(handle);
        resolve()
      }, 4000);
    })
    let receipt = new Receipt(this, action, from, to, amount, receipt_no);
    let div = receipt.get();
    if (this.element.firstElementChild != null) {
      this.element.insertBefore(div, this.element.firstElementChild);
    } else {
      this.element.appendChild(div);
    }
    this.currentReceipt = receipt;
  }
}

// define a simple 80x25 console screen
export class ATMConsole {
  constructor(element) {
    this.element = element;
    this.height = 40;
    this.width = 100;
    this.init();
  }
  init() {
    this.clear();
  }
  scrollUp() {
    this.element.deleteRow(0);
    let row = this.element.insertRow();
    for (let j = 0; j < this.width; j++) {
      row.insertCell();
    }
    this.currentColumn = 0;
  }
  clear() {
    this.element.innerHTML = "";
    for (let i = 0; i < this.height; i++) {
      let row = this.element.insertRow();
      for (let j = 0; j < this.width; j++) {
        row.insertCell();
      }
    }
    this.currentLine = 0;
    this.currentColumn = 0;
  }
  moveTo(x, y) {
    this.currentColumn = x >= this.width ? this.width - 1 : x;
    this.currentLine = y >= this.height ? this.height - 1 : y;
  }
  writeChar(char, advance) {
    if (char === "¶") {
      if (this.currentLine >= this.height - 1) {
        this.scrollUp();
      } else {
        this.currentLine++;
        this.currentColumn = 0;
      }
      return;
    }
    let cell = null;
    try {
      cell = this.element.rows[this.currentLine].cells[this.currentColumn];
    } catch {
      cell = null;
    }
    if (cell) {
      cell.innerHTML = char;
      Tools.play(Sounds.console, 0.1);
      if (advance) {
        this.currentColumn++;
        if (this.currentColumn >= this.width) {
          this.currentColumn = 0;
          if (this.currentLine >= this.height - 1) {
            this.scrollUp();
          } else {
            this.currentLine++;
          }
        }
      }
    }
  }
  async appendText(line) {
    await new Promise(resolve => {
      let chars = Array.from(line);
      chars.reverse();
      let handle = setInterval(() => {
        if (chars.length < 1) {
          resolve();
          clearInterval(handle);
        } else {
          this.writeChar(chars.pop(), true);
        }
      }, 1);
    })
  }
  async appendLines(lines) {
    if (Array.isArray(lines)) {
      await this.appendText(lines.join('¶'))
    } else {
      await this.appendText(arguments.length > 1 ? Array.from(arguments).join('¶') : lines);
    }
  }
  async display(lines) {
    this.clear();
    if (Array.isArray(lines)) {
      await this.appendText(lines.join('¶'))
    } else {
      await this.appendText(arguments.length > 1 ? Array.from(arguments).join('¶') : lines);
    }
  }
}

export class ATMCashReader {
  constructor(dispenser) {
    this.dispenser = dispenser;
    this.insertedNotes = [];
    this.readNotes = [];
    this.waiting = false;
    this.aborting = false;
    this.confirm = false;
  }
  async abort(refund) {
    // abort any process waiting to read cash
    this.confirm = !refund;
    this.aborting = true;    
    await new Promise(resolve => {
      let handle = setInterval(() => {
        if (!this.waiting) {
          clearInterval(handle);
          resolve();
        }
      }, 1);      
    });
    while(this.insertedNotes.length> 0) {
      await this.dispenser.dispenseNote(this.insertedNotes.slice(0,1));
    }
    if (refund) {
      while(this.readNotes.length > 0) {
        await this.dispenser.dispenseNote(this.readNotes.slice(0,1));
      }
      this.aborting = false;
      return null;
    } else {
      // move received notes to dispenser inventory
      this.dispenser.add(this.readNotes);
      let notes = this.readNotes;
      this.readNotes = [];
      this.aborting=false;
      return notes;
    }    
  }
  waitForNote() {
    this.waiting = true;
    this.aborting = false;
    return new Promise(resolve => {
      let handle = setInterval(() => {
        if (this.aborting) {
          clearInterval(handle);
          this.waiting = false;
          resolve(this.confirm);
        }
        if (this.insertedNotes.length > 0) {
          clearInterval(handle)
          let next = this.insertedNotes.splice(0,1);
          this.readNotes.push(next[0]);
          this.waiting = false;
          resolve(next[0]);
        }
        
      }, 1);
    });
  }
  insertNote(note) {
    if (!this.aborting && this.waiting) {
      this.insertedNotes.push(note);
      return true;
    }
    return false;
  }
}