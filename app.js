//jshint esversion:6
require('dotenv').config()
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const port = 3000
const ejs = require('ejs')
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const findOrCreate = require('mongoose-findorcreate')
// const bcrypt = require('bcrypt')
// const saltRounds = 10;

app.use(express.static('public'))
app.set('view engine', 'ejs')

app.use(express.urlencoded({ extended: true }))

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
)

app.use(passport.initialize())
app.use(passport.session())

const mongoose = require('mongoose')
mongoose.connect('mongodb://localhost:27017/userDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

mongoose.set('useCreateIndex', true)

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
})

userSchema.plugin(passportLocalMongoose)
userSchema.plugin(findOrCreate)

const User = new mongoose.model('User', userSchema)

passport.use(User.createStrategy())

passport.serializeUser(function (user, done) {
  done(null, user.id)
})

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user)
  })
})

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: 'http://localhost:3000/auth/google/secrets',
      userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user)
      })
    }
  )
)

app.get('/', (req, res) => {
  res.render('home')
})

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }))

app.get(
  '/auth/google/secrets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets')
  }
)

app.get('/login', (req, res) => {
  res.render('login')
})

app.get('/register', (req, res) => {
  res.render('register')
})

app.get('/secrets', (req, res) => {
  if (req.isAuthenticated()) {
    User.find({ secret: { $ne: null } }, function (err, foundUsers) {
      if (err) {
        console.log(err)
      } else {
        if (foundUsers) {
          res.render('secrets', { usersWithSecrets: foundUsers })
        }
      }
    })
  } else {
    res.redirect('/login')
  }
})

app.get('/logout', (req, res) => {
  req.logout()
  res.redirect('/')
})

app.get('/submit', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('submit')
  } else {
    res.redirect('/login')
  }
})

app.post('/submit', (req, res) => {
  const submittedSecret = req.body.secret

  User.findById(req.user.id, function (err, foundUser) {
    if (err) {
      console.log(err)
    } else {
      if (foundUser) {
        foundUser.secret = submittedSecret
        foundUser.save(function () {
          res.redirect('/secrets')
        })
      }
    }
  })
})

app.post('/register', (req, res) => {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err)
        res.redirect('/register')
      } else {
        passport.authenticate('local')(req, res, function () {
          res.redirect('/secrets')
        })
      }
    }
  )
})

app.post(
  '/login',

  passport.authenticate('local', { failureRedirect: '/login' }),

  function (req, res) {
    res.redirect('/secrets')
  }
)

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
