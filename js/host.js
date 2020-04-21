import { Tools } from './tools.js';

class Member {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.cardNumber = data.cardNumber;
    this.pin = data.pin;
    this.accounts = data.accounts.map(a => new Account(a));
    this.maxTransactionsPerDay = data.maxTransactionsPerDay;
    this.transactions = [];
    this.failedAttempts = data.failedAttempts || 0;
  }
  canTransact() {
    if (this.transactions.length < 1) {
      return "OKAY";
    }
    let d1 = this.transactions[this.transactions.length - 1].timestamp;
    let d2 = new Date();
    let sameDay =
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
    if (!sameDay) {
      this.transactions.length = 0;
      return "OKAY";
    }
    return this.transactions.length < this.maxTransactionsPerDay
      ? "OKAY"
      : "DAILY_LIMIT_EXCEEDED";
  }
  addTransaction(data) {
    this.transactions.push({ timestamp: new Date(), data: data });
  }
}

class Account {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.locks = data.locks || [];
    this.balance = {
      locked: function () {
        return this.locks.reduce((total, lock) => (total += lock.amount), 0);
      }.bind(this),
      available: function () {
        return this.type == "LOAN" ? this.hasRedraw ? this.balance.limit - this.balance.total : 0 : this.balance.total - this.balance.locked();
      }.bind(this),
      pending: 0,
      limit: data.balance.limit || 0,
      total: data.balance.total
    };
    this.maxWithdrawal = data.maxWithdrawal;
    this.hasRedraw = data.type == "LOAN" && data.hasRedraw;
  }
  canWithdraw(amount) {
    if (amount > this.balance.available()) {
      return "INSUFFICIENT_AVAILABLE";
    }
    if (amount > this.maxWidthdrawal) {
      return "LIMIT_EXCEEDED";
    }
    return "OKAY";
  }
  lock(amount) {
    let id =
      this.locks.length < 1
        ? 1
        : this.locks.reduce(
          (max, lock) => (max = max > lock.id ? max : lock.id)
        );
    let test = this.canWithdraw(amount);
    if (test == "OKAY") {
      this.locks.push({ id: id, amount: amount });
      return { id: id, result: "OKAY" };
    }
    return { id: -1, result: test };
  }
  release(id) {
    if (this.locks.length < 1) {
      return "NO_LOCKS";
    }
    let lock = this.locks.filter(lock => lock.id == id);
    if (lock.length > 0) {
      lock = lock[0];
      this.locks.splice(this.locks.indexOf(lock), 1);
      return "OKAY";
    }
    return "LOCK_NOT_FOUND";
  }
  apply(id) {
    if (this.locks.length < 1) {
      return { result: "NO_LOCKS" };
    }
    let lock = this.locks.filter(lock => lock.id == id);
    if (lock.length > 0) {
      lock = lock[0];
      this.balance.total -= lock.amount;
      this.locks.splice(this.locks.indexOf(lock), 1);
      return { result: "OKAY", amount: lock.amount };
    }
    return { result: "LOCK_NOT_FOUND" };
  }
  transfer(destination, amount) {
    let test = this.canWithdraw(amount);
    if (test == "OKAY" || test == "LIMIT_EXCEEDED") {
      this.balance.total -= amount;
      destination.deposit(amount);
      return "OKAY";
    }
    return test;
  }
  deposit(amount) {
    this.balance.total += amount;
    return "OKAY";
  }
}

export class FinancialHost {
  constructor() {
    this.members = [];
    this.sessions = {};
  }
  init() {
    return new Promise((resolve, reject) => {
      Tools.fetchJSONFile("json/accounts.json").then(data => {
        this.members = data.map(m => new Member(m));
        resolve(this);
      }, reject)
    });
  }
  error(request, code, message) {
    return {
      system: {
        session_id: request.system
          ? request.system.session_id || "no session"
          : "error",
        request_id: request.system
          ? request.system.request_id || "error"
          : "error"
      },
      response: {
        result: "error",
        error_code: code,
        error: message
      }
    };
  }
  response(request, payload) {
    return {
      system: {
        session_id: request.system.session_id,
        request_id: request.system.request_id
      },
      response: payload
    };
  }
  api(request) {
    return new Promise((resolve, reject) => {
      if (
        !request.system ||
        !request.system.terminal_id ||
        !request.request ||
        !request.request.call
      ) {
        reject(
          this.error(
            request,
            "BAD_REQUEST",
            "Invalid request submitted, ensure system terminal_id and request payload are included and payload includes api call"
          )
        );
      }
      let call = request.request.call.toLowerCase();
      if (call === "authenticatebycard") {
        if (!request.request.card_number) {
          reject(
            this.error(request, "NO_CARD", "A card number was not provided")
          );
        }
        if (!request.request.pin) {
          reject(this.error(request, "NO_PIN", "A PIN was not provided"));
        }
        let member = this.members.filter(
          m => m.cardNumber == request.request.card_number
        );
        if (member.length > 0) {
          member = member[0];
          if (member.pin == request.request.pin) {
            member.failedAttempts = 0;
            let now = new Date();
            now.setHours(now.getHours() + 1);
            this.sessions[request.system.session_id] = {
              member_id: member.id,
              valid_to: now
            };
            resolve(
              this.response(request, {
                result: "success",
                valid_to: now,
                name: member.title + " " + member.firstName + " " + member.lastName,
                firstName: member.firstName
              })
            );
          }
          member.failedAttempts++;
          resolve(
            this.response(request, {
              result: "fail",
              failure_count: member.failedAttempts
            })
          );
          return;
        }
        reject(
          this.error(
            request,
            "INVALID_CARD",
            "This card does not belong to a member of DSC Bank Daytona"
          )
        );
        return;
      }
      if (!request.system.session_id) {
        reject(
          this.error(
            request,
            request,
            "BAD_REQUEST",
            "Invalid request submitted, ensure system terminal_id and request payload are included and payload includes api call"
          )
        );
        return;
      }

      if (!this.sessions[request.system.session_id]) {
        reject(
          this.error(
            request,
            "NO_SESSION",
            "No session exists for the specified session id"
          )
        );
        return;
      }
      let account = null;
      let result = null;
      let receiptNo = new Date().getTime();
      let member = this.members.filter(
        m => m.id == this.sessions[request.system.session_id].member_id
      );
      if (member.length < 1) {
        reject(
          this.error(
            request,
            "INVALID_SESSION",
            "The session references a non-existent member"
          )
        );
        return;
      }
      member = member[0];
      let mapAccount = a => ({
        account_id: a.id,
        type: a.type,
        name: a.name,
        balance: a.balance.total,
        available: a.balance.available(),
        limit: a.balance.limit,
        hasRedraw: a.hasRedraw
      });
      switch (call) {
        case "listaccountsbytype":
          if (
            ["ALL", "LOAN", "SAVINGS", "CREDIT"].indexOf(request.request.type) <
            0
          ) {
            return this.errors(
              "INVALID_TYPE",
              "The specified account type is invalid"
            );
          }
          resolve(
            this.response(request, {
              result: "success",
              accounts: member.accounts
                .filter(
                  a =>
                    request.request.type == "ALL" ||
                    request.request.type == a.type
                )
                .map(mapAccount)
            })
          );
          return;
        case "listaccountsforoperation":
          if (!request.request.operation) {
            reject(
              this.error(
                request,
                "INVALID_OPERATION",
                "An operation was not specified"
              )
            );
            return;
          }
          switch (request.request.operation.toLowerCase()) {
            case "transfer":
              let source = member.accounts.filter(
                a => a.id == request.request.source_id
              );
              if (source.length < 1) {
                reject(
                  this.error(
                    request,
                    "INVALID_SOURCE_ACCOUNT",
                    "The specified source account does not exist or is not accessible to the member"
                  )
                );
                return;
              }
              source = source[0];
              if (source.type == "LOAN" && !source.hasRedraw) {
                reject(
                  this.error(
                    request,
                    "INVALID_SOURCE_ACCOUNT",
                    "Cannot transfer from loan accounts without redraw facilities"
                  )
                );
                return;
              }
              resolve(
                this.response(request, {
                  result: "success",
                  accounts: member.accounts.filter(a => a.id !== source.id
                    && !(a.type == "LOAN" && a.balance.total == 0)
                    && !(a.type == "CREDIT" && a.balance.total == a.balance.limit)).map(mapAccount)
                })
              );
              return;
            case "deposit":
              resolve(
                this.response(request, {
                  result: "success",
                  accounts: member.accounts.filter(a => !(a.type == "LOAN" && a.balance.total == 0)
                    && !(a.type == "CREDIT" && a.balance.total == a.balance.limit)).map(mapAccount)
                })
              );
              return;
            case "withdraw":
              resolve(
                this.response(request, {
                  result: "success",
                  accounts: member.accounts.filter(
                    (a.type == "LOAN" && a.hasRedraw && (a.balance.total < 0) ||
                      (a.type == "CREDIT" && a.balance.available() > 0)) ||
                    (a.type == "SAVINGS" && a.balance.available() > 0)).map(mapAccount)
                })
              );
              return;
            default:
              reject(
                this.error(
                  request,
                  "INVALID_OPERATION",
                  "The specified operation is not valid"
                )
              );
              return;
          }
        case "accountbalance":
          if (!request.request.account_id) {
            reject(
              this.error(request, "INVALID_ACCOUNT", "No account specified")
            );
            return;
          }
          account = member.accounts.filter(
            a => a.id == request.request.account_id
          );
          if (account.length < 1) {
            reject(
              this.error(
                request,
                "INVALID_ACCOUNT",
                "The specified account does not exist or is not accessible to the member"
              )
            );
            return;
          }
          account = account[0];
          resolve(
            this.response(request, {
              result: "success",
              balance: {
                total: account.balance.total,
                locked: account.balance.locked(),
                available: account.balance.available(),
                limit: account.balance.limit,
                pending: 0
              }
            })
          );
          return;
        case "authorizewithdrawal":
          if (member.canTransact() !== "OKAY") {
            reject(
              this.error(
                request,
                "DAILY_LIMIT_EXCEEDED",
                "The member has already performed the maximum number of transactions today"
              )
            );
            return;
          }
          if (!request.request.account_id) {
            reject(
              this.error(request, "INVALID_ACCOUNT", "No account specified")
            );
            return;
          }
          account = member.accounts.filter(
            a => a.id == request.request.account_id
          );
          if (account.length < 1) {
            reject(
              this.error(
                request,
                "INVALID_ACCOUNT",
                "The specified account does not exist or is not accessible to the member"
              )
            );
            return;
          }
          account = account[0];
          if (isNaN(request.request.amount) || request.request.amount <= 0) {
            reject(
              this.error(
                request,
                "INVALID_AMOUNT",
                "Authorize amount must be greater than 0"
              )
            );
            return;
          }
          result = account.lock(request.request.amount);
          if (result.id > 0) {
            resolve(
              this.response(request, {
                result: "success",
                lock_id: result.id,
                balance: {
                  total: account.balance.total,
                  locked: account.balance.locked(),
                  available: account.balance.available(),
                  limit: account.balance.limit,
                  pending: 0
                }
              })
            );
          }
          reject(
            this.error(
              request,
              result.result,
              "Failed to authorize requested funds"
            )
          );
          return;
        case "applywithdrawal":
          if (member.canTransact() !== "OKAY") {
            reject(
              this.error(
                request,
                "DAILY_LIMIT_EXCEEDED",
                "The member has already performed the maximum number of transactions today"
              )
            );
            return;
          }
          if (isNaN(request.request.lock_id)) {
            reject(
              this.error(
                request,
                "INVALID_LOCK",
                "A lock to apply was not specified"
              )
            );
            return;
          }
          account = member.accounts.filter(
            a => a.locks.filter(l => l.id == request.request.lock_id).length > 0
          );
          if (account.length < 1) {
            reject(
              this.error(
                request,
                "INVALID_LOCK",
                "The specified lock does not exist"
              )
            );
            return;
          }
          account = account[0];
          result = account.apply(request.request.lock_id);
          if (result.result == "OKAY") {
            member.addTransaction({
              type: "WITHDRAWAL",
              from: account.id,
              amount: result.amount,
              receipt: receiptNo
            });
            resolve(
              this.response(request, {
                result: "success",
                balance: {
                  total: account.balance.total,
                  locked: account.balance.locked(),
                  available: account.balance.available(),
                  limit: account.balance.limit,
                  pending: 0
                },
                receipt_no: receiptNo
              })
            );
            return;
          }
          reject(
            this.error(
              request,
              result.result,
              "Failed to apply the specified lock"
            )
          );
          return;
        case "releasewithdrawal":
          if (isNaN(request.request.lock_id)) {
            reject(
              this.error(
                request,
                "INVALID_LOCK",
                "A lock to apply was not specified"
              )
            );
            return;
          }
          account = member.accounts.filter(
            a => a.locks.filter(l => l.id == request.request.lock_id).length > 0
          );
          if (account.length < 1) {
            reject(
              this.error(
                request,
                "INVALID_LOCK",
                "The specified lock does not exist"
              )
            );
            return;
          }
          account = account[0];
          result = account.release(request.request.lock_id);
          if (result == "OKAY") {
            resolve(
              this.response(request, {
                result: "success",
                balance: {
                  total: account.balance.total,
                  locked: account.balance.locked(),
                  available: account.balance.available(),
                  limit: account.balance.limit,
                  pending: 0
                }
              })
            );
            return;
          }
          reject(
            this.error(request, result, "Failed to release the specified lock")
          );
          return;
        case "transferfunds":
          if (member.canTransact() !== "OKAY") {
            reject(
              this.error(
                request,
                "DAILY_LIMIT_EXCEEDED",
                "The member has already performed the maximum number of transactions today"
              )
            );
            return;
          }
          let source = member.accounts.filter(
            a => a.id == request.request.source_id
          );
          if (source.length < 1) {
            reject(
              this.error(
                request,
                "INVALID_SOURCE_ACCOUNT",
                "The specified source account does not exist or is not accessible to the member"
              )
            );
            return;
          }
          source = source[0];
          if (source.type == "LOAN" && !source.hasRedraw) {
            reject(
              this.error(
                request,
                "INVALID_SOURCE_ACCOUNT",
                "Cannot transfer from loan accounts without redraw facilities"
              )
            );
            return;
          }
          let destination = member.accounts.filter(
            a => a.id == request.request.destination_id
          );
          if (destination.length < 1) {
            reject(
              this.error(
                request,
                "INVALID_DESTINATION_ACCOUNT",
                "The specified destination account does not exist or is not accessible to the member"
              )
            );
            return;
          }
          destination = destination[0];
          if (isNaN(request.request.amount) || request.request.amount <= 0) {
            reject(
              this.error(
                request,
                "INVALID_AMOUNT",
                "Authorize amount must be greater than 0"
              )
            );
            return;
          }
          result = source.transfer(destination, request.request.amount);
          if (result == "OKAY") {
            member.addTransaction({
              type: "TRANSFER",
              source: source.id,
              destination: destination.id,
              amount: request.request.amount,
              receipt: receiptNo
            });
            resolve(
              this.response(request, {
                result: "success",
                source: {
                  balance: {
                    total: source.balance.total,
                    locked: source.balance.locked(),
                    available: source.balance.available(),
                    limit: source.balance.limit,
                    pending: 0
                  }
                },
                destination: {
                  balance: {
                    total: destination.balance.total,
                    locked: destination.balance.locked(),
                    available: destination.balance.available(),
                    limit: destination.balance.limit,
                    pending: 0
                  }
                },
                receipt_no: receiptNo
              })
            );
            return;
          } else {
            reject(
              this.error(
                request,
                result,
                "Failed to perform funds transfer, no changes have been made"
              )
            );
            return;
          }
        case "depositfunds":
          if (member.canTransact() !== "OKAY") {
            reject(
              this.error(
                request,
                "DAILY_LIMIT_EXCEEDED",
                "The member has already performed the maximum number of transactions today"
              )
            );
            return;
          }
          if (!request.request.account_id) {
            reject(
              this.error(request, "INVALID_ACCOUNT", "No account specified")
            );
            return;
          }
          account = member.accounts.filter(
            a => a.id == request.request.account_id
          );
          if (account.length < 1) {
            reject(
              this.error(
                request,
                "INVALID_ACCOUNT",
                "The specified account does not exist or is not accessible to the member"
              )
            );
            return;
          }
          if (isNaN(request.request.amount) || request.request.amount <= 0) {
            reject(
              this.error(
                request,
                "INVALID_AMOUNT",
                "Deposit amount must be greater than 0"
              )
            );
            return;
          }
          result = account.deposit(request.request.amount);
          if (result == "OKAY") {
            member.addTransaction({
              type: "DEPOSIT",
              account: account.id,
              amount: request.request.amount,
              receipt: receiptNo
            });
            resolve(
              this.response(request, {
                result: "success",
                balance: {
                  total: account.balance.total,
                  locked: account.balance.locked(),
                  available: account.balance.available(),
                  limit: account.balance.limit,
                  pending: 0
                },
                receipt_no: receiptNo
              })
            );
            return;
          } else {
            reject(this.error(request, result, 'Failed to deposit cash funds'));
            return;
          }
        case "teardownsession":
          delete this.sessions[request.system.session_id];
          resolve(
            this.response(request, {
              result: "success"
            })
          );
          return;
        default:
          reject(
            this.error(
              request,
              "INVALID_CALL",
              "The requested API function is invalid"
            )
          );
          return;
      }
    });
  }
}
