const isStrongPassword = (password) => {
  if (typeof password !== "string" || [...password].length < 10) return false;

  return (
    /\p{L}/u.test(password) &&
    /\p{N}/u.test(password) &&
    /[^\p{L}\p{N}\s]/u.test(password)
  );
};

module.exports = {
  isStrongPassword,
  message: "استخدم 10 أحرف على الأقل مع أحرف وأرقام ورمز خاص",
};
