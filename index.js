const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const svgCaptcha = require('svg-captcha')
const argon2 = require('argon2')
const mysql = require('mysql')

const jsonParser = bodyParser.json()
const urlencodedParser = bodyParser.urlencoded({extended:true})

const connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '1234',
    database : 'bixiv'
})
connection.connect()

const app = express()
app.use(session({
    secret:'Keyboard cat',
    resave:false,
    saveUninitialized: true
}))
app.use('/assets', express.static('assets'));
app.use('/styles', express.static('styles'));

app.get('/', function (req, res) {
    res.sendFile( __dirname + '/index.html' )
})
app.get('/login.html', function (req, res) {
    res.sendFile( __dirname + '/login.html' )
})
app.get('/register.html', function (req, res) {
    res.sendFile( __dirname + '/register.html' )
})
app.get('/index.html', function (req, res) {
    res.sendFile( __dirname + '/index.html' )
})

app.get('/api/captcha', function (req, res) {
    const codeConfig = {
        size: 4,
        ignoreChars: '0oOlI',
        noise: 4,
        width: 135,
        height: 30,
        fontSize: 40,
        color: true,
        background: '#fff',
    }
    const captcha = svgCaptcha.create(codeConfig)
    req.session.captcha = captcha.text
    res.type('svg')
    res.send(captcha.data)
})

app.post('/api/register',urlencodedParser, function (req,res) {
    console.log("register", req.body)
    const username = req.body.username
    const password = req.body.password
    const captcha = req.body.captcha
    if(!req.session.captcha) {
        res.json({
            code:1,
            msg:'请求错误！'
        })
        return
    }
    if(captcha.toLowerCase()!==req.session.captcha.toLowerCase()) {
        console.log(req.session.captcha)
        req.session.captcha=null
        res.json({
            code:1,
            msg:'验证码不一致！'
        })
        return
    }
    connection.query(`select * from user where username='${username}' limit 1`, async function (err,user) {
        if(err) {
            console.log(err)
            res.json({
                code:2,
                msg:'请求错误！'
            })
            return
        }
        if (user.length !== 0) {
            res.json({
                code:2,
                msg:'用户名已存在！'
            })
            return
        }
        const hash = await argon2.hash(password, {
            type: argon2.argon2i,
            hashLength: 32,
            timeCost : 3,
            memoryCost: 2 ** 16,
            parallelism :1,
        })
        console.log("hash", hash)
        connection.query(`insert into user (username, password) value ('${username}', '${hash}')`)
        res.json({
            code:0,
            msg:'注册成功！'
        })
    })
})

app.post('/api/login',urlencodedParser, function (req,res) {
    console.log("login", req.body)
    const username = req.body.username
    const password = req.body.password
    connection.query(`select * from user where username='${username}' limit 1`, async function (err,user) {
        if (err) {
            console.log(err)
            res.json({
                code: 1,
                msg: '请求错误！'
            })
            return
        }
        if (user.length === 0) {
            res.json({
                code: 1,
                msg: '用户名不存在！'
            })
            return
        }
        const username = user[0].username
        const hash = user[0].password
        const is = await argon2.verify(hash, password)
        console.log(is)
        if(is===false) {
            res.json({
                code: 1,
                msg: '密码不正确！'
            })
            return
        }
        req.session.login = true
        req.session.user = username
        res.json({
            code: 0,
            msg: '登陆成功！'
        })
    })
})

app.get('/api/login_user',function (req,res) {
    res.json({
        login: req.session.login,
        user: req.session.user
    })
})

app.get('/api/logout',function (req,res) {
    console.log("logout")
    req.session.destroy(function(err){undefined
        if(err) throw err;
        res.redirect('/login.html');
    });
})

const server = app.listen(8080,'localhost', function () {
    const address = server.address().address
    const port = server.address().port
    console.log("http://%s:%s", address, port)
})