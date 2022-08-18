const { checkSchema } = require('express-validator')

module.exports = {
  signup: checkSchema({
    name: {
      trim: true,
      isLength: {
        options: { min: 2 }
      },
      errorMessage: 'Nome precisa ter pelo menos 2 caracteres'
    },
    email: {
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
      notEmpty: true,
      errorMessage: 'estado não preenchido!'
    }
  }),
  signin: checkSchema({
    email: {
      isEmail: true,
      normalizeEmail: true,
      errorMessage: 'E-mail inválido'
    },
    password: {
      isStrongPassword: {
        options: {
          minLength: 5,
          minUppercase: 1,
          minLowercase: 1,
          minNumbers: 1,
          minSymbols: 1
        }
      },
      errorMessage:
        'Senha deve ter pelo menos 5 caracteres (maiúsculas, minúsculas, números e caracteres especiais).'
    }
  })
}
