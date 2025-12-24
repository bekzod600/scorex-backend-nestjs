export const RATING_RULES = {
  BASE_SCORE: 1000,

  FREE: {
    TP: +1,
    SL: -2,
    CANCEL: 0,
  },

  PAID: {
    TP: +2,
    SL: -3,
    CANCEL: -1,
  },

  PROFIT_BONUS_STEP: 10, // %
  PROFIT_BONUS_SCORE: 1,
};
