const express = require("express");
const app = express();
const port = 8080;

app.set("json spaces", 2);

//アクセスログミドルウェア
app.use(function (req, res, next) {
    const reqUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
    const reqDate = new Date();
    const srcIpAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    console.log(`${reqDate} Access "${reqUrl}" from ${srcIpAddr}`);
    next();
});

//静的ファイルのルーティング
app.use(express.static("./static", { fallthrough: true }));
//起動
app.listen(port, () => {
    console.log("server started on port:" + port);
});

app.get("/test", function (req, res) {
    res.send("テストです")
});

app.get("/api/:userId", function (req, res) {
    res.json(
        {
            name: "Jhon Doe",
            userId: `${req.params.userId}`,
            attr: { age: 30, sex: "male" }
        });
});


//ルーティングのエラーハンドリング
app.use(function (req, res, next) {
    res.status(404).send('ERROR 404 not found');
});