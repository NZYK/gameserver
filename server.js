//.envファイル内の変数を環境変数として扱うモジュールを有効化
require('dotenv').config();

//expressの初期設定
const express = require("express");
const app = express();
const port = 8080;
const http = require("http");
const server = http.createServer(app);

//SocketIOの初期設定
const { Server } = require("socket.io");
const io = new Server(server);

//セッションモジュールをインポート（サーバー側にセッションデータを持たせる）
const session = require("express-session");

//.env内の環境変数によってセッションに使用するDBを使い分ける
let sessionStore;
if (process.env.USE_DB_FOR_SESSION === "mysql") {
    const mysqlSession = require("express-mysql-session")(session);
    const mysqlOptions = {
        host: "localhost",
        port: process.env.MYSQL_PORT,
        user: process.env.MYSQL_USERNAME,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE
    }
    sessionStore = new mysqlSession(mysqlOptions);
} else {
    sessionStore = new session.MemoryStore;
}
//セッション用の設定
const sess = {
    secret: "NZYKsecret",
    resave: false, //セッション内容に変更がないときにはデータをリセーブしない
    saveUninitialized: true, //初期化されていないセッションも保存するか:true
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 30 }, //保持期間 1000ms * 60sec * 60min * 24hours * 30 days
    store: sessionStore, //セッションの保存先
    name: "NZYKconnect.sid"
}
//本番環境に移したときのみ実行する設定
if (app.get("env") === "production") {
    app.set("trust proxy", 1);//プロキシサーバーから1番目をクライアントのIPとして扱う
    sess.cookie.secure = true;//HTTPSによるアクセス時のみcookieを有効化する
}

io.use(function(socket,next){
    session(sess)(socket.request,socket.request.res || {}, next);
})

//ほぼjinja2のテンプレートエンジンをインポート
const jinja = require("nunjucks");
jinja.configure("./static/template", {
    autoscape: true,
    express: app
});
app.set("views", "./static/template")
app.set("view engine", "html");

//jsonのフォーマット設定
app.set("json spaces", 2);

//セッションミドルウェア
app.use(session(sess));

//アクセスログミドルウェア
app.use(function (req, res, next) {
    const reqUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
    const reqDate = new Date();
    const srcIpAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    console.log(`${reqDate} Access "${reqUrl}" from ${srcIpAddr}`);
    next();
});

//postデータハンドリングのためのミドルウェア
app.use(express.urlencoded({ extended: true }));

//静的ファイルのルーティングを行うミドルウェア
app.use(express.static("./static", { fallthrough: true }));

//socketIOの中にもセッションミドルウェアを通してrequestオブジェクトを扱えるようにする（超重要）
io.use(function(socket,next){
    session(sess)(socket.request,socket.request.res || {}, next);
})

//ルーティングテスト
app.get("/test", function (req, res) {
    res.send("テストです")
});

//WebAPI(Jsonを返す)テストとuserIdをURLから取得するテスト
app.get("/api/:userId", function (req, res) {
    res.json(
        {
            name: "Jhon Doe",
            userId: `${req.params.userId}`,
            attr: { age: 30, sex: "male" }
        });
});

//テンプレートエンジンによるカウントページのテスト
let count = 0;
app.get("/template", function (req, res) {
    count++;
    res.render("sample.html", { counter: count });
});

//テンプレートの継承とpostのテスト実装
app.get("/create", function (req, res) {
    res.render("create.html");
});
app.post("/create", function (req, res) {
    console.log(req.body);
    res.render("create.html");
});

//お名前ページ req.session.プロパティ名で各種プロパティを保存
app.get("/login", function (req, res) {
    res.render("login.html");
});
app.post("/login", function (req, res) {
    console.log(req.body);
    req.session.userName = req.body.userName;
    console.log("このユーザーの名前は" + req.session.userName + "で登録されました。")
    res.redirect("/");
});

//セッション利用のテスト
app.get("/session", function (req, res) {
    if (req.session.counter) {
        req.session.counter++;
    } else {
        req.session.counter = 1;
    }
    res.send(`<html><body>
            <p>${req.session.counter}</p>
            <p>domain:${req.session.cookie.domain}</p>
            <p>expires:${req.session.cookie.expires}</p>
            <p>httpOnly:${req.session.cookie.httpOnly}</p>
            <p>maxAge:${req.session.cookie.maxAge}</p>
            <p>originalMaxAge:${req.session.cookie.originalMaxAge}</p>
            <p>path:${req.session.cookie.path}</p>
            <p>sameSite:${req.session.cookie.sameSite}</p>
            <p>secure:${req.session.cookie.secure}</p>
            <p>signed:${req.session.cookie.signed}</p>
    </body></html>`);
});

//ルーティングの404エラーハンドリング
app.use(function (req, res, next) {
    res.status(404).send('ERROR 404 not found');
});

//socketIO処理記述部
io.on("connection", (socket) => {
    const sessionData = socket.request.session;
    let userName;
    if ( sessionData.userName ){
        userName = sessionData.userName;
    } else {
        userName = "ななし";
    }
    socket.broadcast.emit("chat message",""+userName+"さんが入室しました")

    socket.on("chat message", (msg) => {
        io.emit("chat message", msg);
    })
    socket.on("disconnect", () => {
        socket.broadcast.emit("chat message",""+userName+"さんが退室しました");
    })
})

//起動
server.listen(port, () => {
    console.log("server started on port:" + port);
});