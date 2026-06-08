// Global NordPass 2023 ranking, positions 1–100 (including repeated entries).
// Original report: https://nordpass.com/most-common-passwords-list/
// Preserved 2023 table: https://docomolabo.com/cyber-security/password-2023/
// Keep this snapshot: the original URL now shows a newer annual report.
export const COMMON_PASSWORDS_2023 = Object.freeze([
  "123456", "admin", "12345678", "123456789", "1234", "12345", "password", "123", "Aa123456", "1234567890",
  "UNKNOWN", "1234567", "123123", "111111", "Password", "12345678910", "000000", "admin123", "********", "user",
  "1111", "P@ssw0rd", "root", "654321", "qwerty", "Pass@123", "******", "112233", "102030", "ubnt",
  "abc123", "Aa@123456", "abcd1234", "1q2w3e4r", "123321", "err", "qwertyuiop", "87654321", "987654321", "Eliska81",
  "123123123", "11223344", "987654321", "demo", "12341234", "qwerty123", "Admin@123", "1q2w3e4r5t", "11111111", "pass",
  "Demo@123", "**********", "azerty", "admintelecom", "Admin", "123meklozed", "666666", "123456789", "121212", "1234qwer",
  "admin@123", "1qaz2wsx", "*************", "123456789a", "Aa112233", "asdfghjkl", "Password1", "888888", "admin1", "test",
  "Aa123456@", "asd123", "qwer1234", "123qwe", "202020", "asdf1234", "Abcd@1234", "banned", "12344321", "aa123456",
  "1122334455", "Abcd1234", "guest", "88888888", "Admin123", "secret", "1122", "admin1234", "administrator", "Password@123",
  "q1w2e3r4", "10203040", "a123456", "12345678a", "555555", "zxcvbnm", "welcome", "Abcd@123", "Welcome@123", "minecraft",
]);

// Case variants of a common password are also rejected.
export const commonPasswords = new Set(COMMON_PASSWORDS_2023.map((password) => password.toLowerCase()));
