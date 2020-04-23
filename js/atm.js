import {
  ATMConsole,
  ATMCashDispenser,
  ATMCardReader,
  ATMPinReader,
  ATMReceiptPrinter
} from "./devices.js";
import { FinancialHost } from "./host.js";
import { Tools, Sounds } from "./tools.js";

let art = [
  "Initializing...",
  "",
  "System Start Up - RobTech Bios 1.2",
  "",
  "                     ______",
  "                    /     /\\",
  "                   /     /##\\",
  "                  /     /####\\             FigOS v9.53 - Welcome to Figland",
  "                 /     /######\\",
  "                /     /########\\",
  "               /     /##########\\          initfs.startup....             [OKAY]",
  "              /     /#####/######\\         bringing up flux capacitor...  [OKAY]",
  "             /     /#####/++######\\        near-solar satellite online... [OKAY]",
  "            /     /#####/++++######\\       splining paths...              [OKAY]",
  "           /     /#####/+++++#######\\      pathing splines...             [FAIL]",
  "          /     /#####/  +++++#######\\",
  "         /     /#####/    +++++#######\\    error, personality core corruption at 5%",
  "        /     /#####/      +++++#######\\   resuming...",
  "       /     /#####/        +++++#######\\",
  "      /     /#####/__________+++++#######\\",
  "     /                        +++++#######\\",
  "    /__________________________+++++######/",
  "    +++++++++++++++++++++++++++++++++####/",
  "     +++++++++++++++++++++++++++++++++##/",
  "      +++++++++++++++++++++++++++++++++/",
  "      ``````````````````````````````````",
  "",
  ""
];

export class ATM {
  constructor(consoleElement, cardreaderElement, pinreaderElement, dispenserElement, printerElement) {
    console.log("Manufacturing new ATM");
    this.console = new ATMConsole(consoleElement);
    this.dispenser = new ATMCashDispenser(dispenserElement);
    this.cardreader = new ATMCardReader(cardreaderElement);
    this.pinreader = new ATMPinReader(pinreaderElement);
    this.printer = new ATMReceiptPrinter(printerElement);
    this.id = 715;
    this.host = new FinancialHost();
    this.session = null;
  }
  async init() {
    await Tools.play(Sounds.startup);
    await this.host.init();
    //await this.console.display(art);
    while (true) {
      await this.waitForCard();
    }
  }
  async callAPI(call, payload) {
    let requestId = new Date().getTime();
    payload.call = call;
    let request = {
      system: {
        session_id: this.session ? this.session.session_id : null,
        request_id: requestId,
        terminal_id: 715
      },
      request: payload
    };
    return await this.host.api(request);
  }
  async readAmount(prompt) {
    await this.console.appendLines(["", prompt]);
    return await new Promise(resolve => {
      let input = "";
      let handle = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          let val = Number(e.key);
          if (val >= 0 && val <= 9) {
            input += val;
            this.console.writeChar(val, true);
          } else if (e.keyCode == 13) {
            Tools.removeEventHandler(handle);
            resolve(input);
          } else {
            Tools.play(Sounds.error);
          }
        },
        this
      );
    });
  }
  async readKey(prompt, set, cancel) {
    await this.console.appendLines(["", prompt]);
    return await new Promise(resolve => {
      let handle = Tools.addEventHandler(
        document,
        "keyup",
        e => {
          if (e.keyCode == 27 && cancel) {
            resolve(e.keyCode);
          }
          else if (set.indexOf(e.key) >= 0) {
            this.console.writeChar(e.key, true);
            Tools.removeEventHandler(handle);
            resolve(e.key);
          } else {
            Tools.play(Sounds.error);
          }
        },
        this
      );
    });
  }
  async getAccountList() {
    try {
      const response = await this.callAPI("listaccountsbytype", { type: "ALL" });
      this.session.accounts = response.response.accounts;
    }
    catch (response) {
      this.console.log(response);
      throw "Error: " + (response.response && response.response.error ? response.response.error : response);
    }
  }
  async runEjectCard(reason) {
    await this.console.appendLines(`¶${reason}¶`);
    await this.console.appendLines("¶Ejecting card. Please take your card.¶")
    await this.cardreader.ejectCard();
    await this.cardreader.waitForTakeCard();
  }
  async runAccountsList() {
    try {
      while (true) {
        await this.getAccountList();
        await this.accountListHeader();
        await this.listAccounts();
        let account = await this.selectAccount();
        await this.runManageAccount(account);
      }
    }
    catch (reason) {
      await this.runEjectCard(reason);
    }
  }
  async accountListHeader() {
    if (this.session.accounts.length > 0) {
      await this.console.appendLines(`¶You have ${this.session.accounts.length} accounts:¶`);
    } else {
      throw "You do not have any accessible accounts.";
    }
  }
  async listAccounts() {
    this.console.writeChar('¶');
    await this.console.appendLines(this.session.accounts.map((a, i) => `[${i + 1}] ${a.name} (${a.type}), Balance: ${a.balance.toFixed(2)}, Available: ${a.available.toFixed(2)}`));
  }

  async selectAccount() {
    while (true) {
      let key = await this.readKey(`¶Please select an account to manage (1 - ${this.session.accounts.length}, [ESC] to Cancel): `, this.session.accounts.map((a, i) => (i + 1)).join(""), true);
      if (key == 27) {
        throw "Cancel.";
      } else {
        let num = Number(key);
        if (num > 0 && num <= this.session.accounts.length) {
          await this.console.appendLines(`¶¶You selected: ${this.session.accounts[num - 1].name}¶`);
          return this.session.accounts[num - 1];
        } else {
          Tools.play(Sounds.error);
        }
      }
    }
  }

  // runManageAccount uses the selected account as a basis for executing deposits, withdrawals, and transfers
  async runManageAccount(account) {
    switch (account.type) {
      case "SAVINGS":
        await this.runManageSavings(account);
        break;
      case "CREDIT":
        await this.runManageCredit(account);
        break;
      case "LOAN":
        await this.runManageLoan(account);
        break;
    }
  }
  async runManageSavings(account) {
    let options = [];
    if (account.available > 0) {
      options.push("Cash Withdrawal");
      options.push("Funds Transfer");
    }
    options.push("Cash Deposit");
    if (options.length < 1) {
      this.console.appendLines("¶This account has no viable operations.¶");
      return;
    }
    let prompt = `Select an operation: ${options.map((o, i) => `[${i + 1}] ${o}`).join(" ")} [ESC] Cancel:`;
    while (true) {
      let key = await this.readKey(prompt, options.map((o, i) => i + 1).join(""), true);
      if (key == 27) {
        await this.console.appendLines("¶¶Cancel.¶");
        return;
      }
      let num = Number(key);
      if (num > 0 && num <= options.length) {
        switch (options[num - 1]) {
          case "Cash Withdrawal":
            await this.console.appendLines(`¶¶You selected: Cash Withdrawal from ${account.name}¶`);
            await this.runWithdraw("Cash Withdrawal", account, account.available);
            return;
          case "Funds Transfer":
            await this.console.appendLines(`¶¶You selected: Funds Transfer from ${account.name}¶`);
            await this.runTransfer("Funds Transfer", account, account.available);
            return;
          case "Cash Deposit":
            await this.console.appendLines(`¶¶You selected: Cash Deposit to ${account.name}¶`);
            await this.runDeposit("Cash Deposit", account, -1);
            return;
          default:
            Tools.play(Sounds.error);
        }
      } else {
        Tools.play(Sounds.error);
      }
    }
  }
  async runManageCredit(account) {
    let options = [];
    if (account.available > 0) {
      options.push("Cash Advance");
      options.push("Funds Transfer");
    }
    if (account.total < account.limit) {
      options.push("Cash Deposit");
    }
    if (options.length < 1) {
      await this.console.appendLines("¶This account has no viable operations.¶");
      return;
    }
    let prompt = `Select an operation: ${options.map((o, i) => `[${i + 1}] ${o}`).join(" ")} [ESC] Cancel:`;
    while (true) {
      let key = await this.readKey(prompt, options.map((o, i) => i + 1).join(""), true);
      if (key == 27) {
        await this.console.appendLines("¶¶Cancel.¶");
        return;
      }
      let num = Number(key);
      if (num > 0 && num <= options.length) {
        switch (options[num - 1]) {
          case "Cash Advance":
            await this.console.appendLines(`¶¶You selected: Cash Advance from ${account.name}¶`);
            await this.runWithdraw("Cash Advance", account, account.available);
            return;
          case "Funds Transfer":
            await this.console.appendLines(`¶¶You selected: Funds Transfer from ${account.name}¶`);
            await this.runTransfer("Funds Transfer", account, account.available);
            return;
          case "Cash Deposit":
            await this.console.appendLines(`¶¶You selected: Cash Deposit to ${account.name}¶`);
            await this.runDeposit("Cash Deposit", account, account.limit - account.total);
            return;
          default:
            Tools.play(Sounds.error);
        }
      } else {
        Tools.play(Sounds.error);
      }
    }
  }
  async runManageLoan(account) {
    let options = [];
    if (account.hasRedraw && account.available) {
      options.push("Redraw Cash");
      options.push("Redraw Transfer");
    }
    if (account.balance < 0) {
      options.push("Cash Payment");
    }
    if (options.length < 1) {
      await this.console.appendLines("¶This account has no viable operations.¶")
      return;
    }
    let prompt = `Select an operation: ${options.map((o, i) => `[${i + 1}] ${o}`).join(" ")} [ESC] Cancel:`;
    while (true) {
      let key = await this.readKey(prompt, options.map((o, i) => i + 1).join(""), true);
      if (key == 27) {
        await this.console.appendLines("¶¶Cancel.¶");
        return;
      }
      let num = Number(key);
      if (num > 0 && num <= options.length) {
        switch (options[num - 1]) {
          case "Redraw Cash":
            await this.console.appendLines(`¶¶You selected: Redraw Cash from ${account.name}¶`);
            await this.runWithdraw("Redraw Cash", account, account.available);
            return;
          case "Redraw Transfer":
            await this.console.appendLines(`¶¶You selected: Redraw Transfer from ${account.name}¶`);
            await this.runTransfer("Redraw Transfer", account, account.available);
            return;
          case "Cash Payment":
            await this.console.appendLines(`¶¶You selected: Cash Payment to ${account.name}¶`);
            await this.runDeposit("Cash Payment", account, -account.balance);
            return;
          default:
            Tools.play(Sounds.error);
        }
      } else {
        Tools.play(Sounds.error);
      }
    }
  }
  async runWithdraw(action, account, max) {
    max = max > 500 ? 500 : max;
    while (true) {
      let amount = await this.readAmount(`¶Please enter an amount (max: ${max.toFixed(2)}): `);
      let val = Number(amount);
      if (val > 0 && val <= max) {
        let key = await this.readKey(`¶¶${action}: ${val.toFixed(2)}? (Y/N): `, "YNyn", false);
        if (key == 27) {
          await this.console.appendLines("¶¶Canceled.¶");
          return;
        }
        else if (key == "Y" || key == "y") {
          try {
            let response = await this.callAPI("authorizewithdrawal", {
              account_id: account.account_id,
              amount: val
            });
            if (response.response.result == "success") {
              let lock = response.response.lock_id;
              try {
                await this.dispenser.dispense(val);
                try {
                  let response = await this.callAPI("applywithdrawal", { lock_id: lock });
                  account.total = response.response.balance.total;
                  account.available = response.response.balance.available;
                  account.limit = response.response.balance.limit;
                  await this.printer.print("withdrawal", `${account.account_id}:${account.name}`, 'CASH', val, response.response.receipt_no);
                  await this.console.appendLines(`¶¶Cash dispensed. Receipt No: ${response.response.receipt_no}¶`);
                  return;
                }
                catch (response) {
                  await this.console.appendLines(`¶¶Error:${response.response.error}¶`);
                  try {
                    let response2 = await this.callAPI("releasewithdrawal", { lock_id: lock });
                    account.total = response2.response.balance.total;
                    account.available = response2.response.balance.available;
                    account.limit = response2.response.balance.limit;
                    await this.console.appendLines("¶¶Reserved funds released.¶");
                    return;
                  }
                  catch
                  {
                    await this.console.appendLines(`¶¶Reserved funds could not be released¶Please attend a branch to arrange release of locked funds¶`);
                    return;
                  }
                }
              }
              catch (amount) {
                await this.console.appendLines(`¶¶Cash dispensing failed, only ${amount.toFixed(2)} could be dispensed¶Please attend a branch to arrange release of locked funds¶`);
                return;
              }
            } else {
              await this.console.appendLines(`¶¶Could not lock funds for withdrawal: ${response.response.error}¶`);
              return;
            }
          }
          catch (response) {
            await this.console.appendLines(`¶¶Could not lock funds for withdrawal: ${response.response.error}¶`);
            return;
          }
        }
      } else {
        await this.console.appendLines("¶Invalid amount entered.¶");
        Tools.play(Sounds.error);
      }
    }
  }
  async runTransfer(action, account, max) {
    // we have two considerations for a transfer - the max we can take from the source account, and the max we can deposit to the destination account
    // we only allow the smaller of the two.
    // first we need to get the user to select a destination account valid for this source account
    let response = null;
    try {
      response = await this.callAPI("listaccountsforoperation", { source_id: account.account_id, operation: "TRANSFER" });
    }
    catch {
      await this.console.appendLines("¶Could not retrieve list of target accounts¶");
      return;
    }
    if (response.response.accounts.length < 1) {
      await this.console.appendLines("¶Error: There are no valid target accounts to transfer to.¶");
      return;
    } else {
      await this.console.appendLines("¶Please select a destination account:¶");
      await this.console.appendLines(`¶${response.response.accounts.map((a, i) => `[${i + 1}] ${a.name}`).join('¶')}¶`);
      let destination = null;
      while (!destination) {
        let key = await this.readKey(`¶Select account (1 - ${response.response.accounts.length}, [ESC] to cancel): `, response.response.accounts.map((a, i) => (i + 1)).join(''), true);
        if (key == 27) {
          await this.console.appendLines("¶¶Canceled.¶");
          return;
        }
        let num = Number(key);
        if (num > 0 && num <= response.response.accounts.length) {
          destination = this.session.accounts.filter(a => a.account_id == response.response.accounts[num - 1].account_id);
          if (destination.length < 1) {
            destinationm = response.response.accounts[num - 1];
            this.session.accounts.push(destination);
          } else {
            destination = destination[0];
          }
        } else {
          await this.console.appendLines("¶¶Invalid account selection¶");
          await Tools.play(Sounds.error);
        }
      }
      await this.console.appendLines(`¶¶You selected ${action} from ${account.name} to ${destination.name}¶`);
      // now we have both accounts, we need to determine the maximum transfer amount
      let destMax = 0;
      switch (destination.type) {
        case "SAVINGS":
          destMax = destination.limit - destination.balance;
          break;
        case "CREDIT":
          destMax = destination.limit - destination.balance;
          break;
        case "LOAN":
          destMax = destination.limit != 0 ? -(destination.limit - destination.balance) : -destination.balance;
          break;
      }
      max = destMax < max ? destMax : max;
      let amount = null;
      do {
        amount = Number(await this.readAmount(`¶Please enter an amount (max: ${max.toFixed(2)}): `));
        if (amount <= 0 || amount > max) {
          await this.console.appendLines("¶¶Invalid Amount.¶");
          amount = null;
        }
      } while (!amount);
      switch (await this.readKey(`¶¶${action} ${amount.toFixed(2)} from ${account.name} to ${destination.name}? (Y/N): `, "YNyn", false)) {
        case "N":
        case "n":
          await this.console.appendLines("¶¶Canceled.¶");
          return;
        case "Y":
        case "y":
          // perform transfer
          try {
            let response3 = await this.callAPI("transferfunds", { source_id: account.account_id, destination_id: destination.account_id, amount: amount });
            if (response3.response.result == "success") {
              account.total = response3.response.source.balance.total;
              account.available = response3.response.source.balance.available;
              account.limit = response3.response.source.balance.limit;
              destination.total = response3.response.destination.balance.total;
              destination.available = response3.response.destination.balance.available;
              destination.limit = response3.response.destination.balance.limit;
              await this.printer.print(action, `${account.account_id}:${account.name}`, `${destination.account_id}:${destination.name}`, amount, response3.response.receipt_no);
              await this.console.appendLines(`¶¶${action} complete. Receipt No: ${response3.response.receipt_no}¶`);
              return;
            }
          }
          catch (response) {
            await this.console.appendLines(`¶¶Error: ${response.response.error}¶`);
            return;
          }
        default:
          await Tools.play(Sounds.error);
          return;
      }
    }
  }
  async waitForNoteOrKey() {
    return new Promise(resolve => {
      let handle1, handle2;
      handle1 = Tools.addEventHandler(document, "keyup", e => {
        if (e.keyCode == 27 || e.keyCode == 13) {
          Tools.removeEventHandler(handle1);
          Tools.removeEventHandler(handle2);
          resolve(e.keyCode);
        } else {
          Tools.play(Sounds.error);
        }
      });
      handle2 = Tools.addEventHandler(document, "insert-note", e => {
        Tools.removeEventHandler(handle1);
        Tools.removeEventHandler(handle2);
        resolve(e.detail);      
      })  
    });
  }
  async runDeposit(action, account, max) {
    document.dispatchEvent(new CustomEvent("insert-enabled"));
    let maxtext = max > 0 ? `(max: ${max.toFixed(2)})` : '';
    await this.console.appendLines(`¶¶Please insert cash bills into the reader ${maxtext}. ([ESC] to cancel and return notes, [ENTER] to confirm):¶`);
    let note = '';
    let notes = [];
    let total = 0;
    do {
      note = await this.waitForNoteOrKey()
      if (typeof note === 'string') {
        notes.push(note);
        total += Number(note);
        await this.console.appendLines(`¶Note Read: $${note}, Total: $${total.toFixed(2)}¶`);
      }
    } while (note != 27 && note != 13);
    document.dispatchEvent(new CustomEvent("insert-disabled"));
    if (note == 27) {
      await this.console.appendLines("¶¶Canceled. Please take your cash.¶");
      notes.forEach(note => await this.dispenser.dispenseNote(note));
    } else {
      if (max > 0 && total > max) {        
        await this.console.appendLines("¶¶Maximum amount exceeded. Please take your cash.¶");
        notes.forEach(note => await this.dispenser.dispenseNote(note));
      } else {
        let key = await this.readKey(`¶Total inserted: ${total.toFixed2}. Proceed with ${action}? (Y/N):`, 'YNyn', false);
        switch(key) {
          case "Y":
          case "y":
            try {
              let response = await this.callAPI("depositfunds", { account_id: account.account_id, amount: total });
              if (response.response.result == "success") {
                await this.console.appendLines(`¶${action} successful. Receipt No: ${response.response.receipt_no}¶`);
                await this.printer.print(action, "CASH", account, total, response.response.receipt_no);
              } else {
                await this.console.appendLines(`¶${action} failed. Please take your cash.¶`);
                notes.forEach(note => await this.dispenser.dispenseNote(note));
              }
            } catch (response) {
              await this.console.appendLines(`Error: ${response.response.error}. Please take your cash.¶`);
              notes.forEach(note => await this.dispenser.dispenseNote(note));
            }
            break;
          case "N":
          case "n":
            notes.forEach(note => await this.dispenser.dispenseNote(note));
            break;
          default:
            await Tools.play(Sounds.error);
            break;
        }
      }
    }
  }
  async waitForCard() {
    do {
      await this.console.display(`¶DSC Bank of Daytona - Your Education, Our Money¶~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~¶¶Automatic Teller Machine#: ${this.id}¶¶Please insert your membership card to begin...`);
      let cardnumber = await this.cardreader.waitForCard();
      this.session = {
        cardnumber: cardnumber,
        session_id: new Date().getTime() + "_SESSION"
      };
      await this.console.appendLines(`¶¶Card number: ${cardnumber}¶`);
    }
    while (!await this.waitForPIN());
    await this.runAccountsList();
  }
  async waitForPIN() {
    while (true) {
      await this.console.appendLines("¶Please enter your personal identification number (PIN), [ESC] to cancel, [ENTER] to confirm.¶");
      try {
        let pin = await this.pinreader.waitForPIN();
        try {
          let response = await this.callAPI("authenticatebycard", { card_number: this.session.cardnumber, pin: pin });
          if (response.response.result === "success") {
            this.session.valid_to = response.response.valid_to;
            this.session.name = response.response.name;
            this.session.firstName = response.response.firstName;
            return true;
          } else {
            if (response.response.failure_count >= 3) {
              Tools.play(Sounds.error);
              await this.console.appendLines("¶Verification failed. PIN incorrect.¶¶Attempts Exceeded. Card captured.¶¶Please attend a DSC Bank Daytona branch to retrieve your card¶");
              this.cardreader.captureCard();
              await new Promise(resolve => {
                setTimeout(resolve, 2000);
              });
              return false;
            } else {
              Tools.play(Sounds.error);
              await this.console.appendLines("¶Verification failed. PIN incorrect.¶");
            }
          }
        } catch (response) {
          throw response.response && response.response.error ? response.response.error : "Unknown error occurred!";
        }
      }
      catch {
        await this.runEjectCard("¶Canceled.¶");
        return false;
      }
    }
  }
}
