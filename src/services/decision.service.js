export const buildReply = (intent) => {
  switch (intent) {
    case "greeting":
      return "👋 Hola, dime qué gasto o ingreso quieres registrar";
    case "expense":
      return "💸 Entendido, estoy registrando tu gasto";
    case "income":
      return "💰 Perfecto, ingreso anotado";
    case "balance":
      return "📊 Aún estoy aprendiendo, pronto verás tu balance";
    default:
      return "🤔 No entendí bien, ¿puedes repetirlo?";
  }
};
