const { checkSchema } = require('express-validator')

module.exports = {
  editAction: checkSchema({
    token: {
      notEmpty: true
    },
    name: {
      optional: true,
      trim: true,
      isLength: {
        options: { min: 2 }
      },
      errorMessage: 'Nome precisa ter pelo menos 2 caracteres'
    },
    email: {
      optional: true,
      isEmail: true,
      normalizeEmail: true,
      errorMessage: 'E-mail inválido'
    },
    password: {
      optional: true,
      isLength: {
        options: { min: 3 }
      },
      errorMessage: 'Senha deve ter pelo menos 3 caracteres.'
    },
    state: {
      optional: true,
      notEmpty: true,
      errorMessage: 'estado não preenchido!'
    }
  })
}
