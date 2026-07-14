export class DatabaseError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = "DatabaseError";
  }
}
