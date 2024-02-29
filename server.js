//.envファイル内の変数を環境変数として扱うモジュールを有効化
require('dotenv').config();

//expressの初期設定
const express = require("express");
const app = express();
const port = 3500;
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
    console.log("今本番環境です！")
    app.set("trust proxy", 1);//プロキシサーバーから1番目をクライアントのIPとして扱う
    sess.cookie.secure = true;//HTTPSによるアクセス時のみcookieを有効化する
}

//ほぼjinja2のテンプレートエンジンをインポート
const jinja = require("nunjucks");
jinja.configure("./static/template", {
    autoscape: true,
    express: app
});
//テンプレートエンジンをexpressに設定
app.set("views", "./static/template");
app.set("view engine", "html");

//jsonのフォーマット設定
app.set("json spaces", 2);

//セッションミドルウェア
app.use(session(sess));

//アクセスログミドルウェア
// app.use(function (req, res, next) {
//     const reqUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
//     const reqDate = new Date();
//     const srcIpAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
//     console.log(`${reqDate} Access "${reqUrl}" from ${srcIpAddr}`);
//     next();
// });

//postデータハンドリングのためのミドルウェア
app.use(express.urlencoded({ extended: true }));

//静的ファイルのルーティングを行うミドルウェア
app.use(express.static("./static", { fallthrough: true }));

//socketIOの中にもセッションミドルウェアを通してrequestオブジェクトを扱えるようにする（超重要）
io.use(function (socket, next) {
    session(sess)(socket.request, socket.request.res || {}, next);
})

//ルーム系の処理
let rooms = {};
//ルームクラスはルーム全体の状態と、ゲーム開始前のステータスを保有
class Room {
    constructor(roomName, creater) {
        this.roomId = (new Date().getTime() + (Math.floor(1000 * Math.random()) * 1000000000)).toString(16);
        this.roomName = roomName;
        this.creater = creater;
        this.players = {};
        this.game = null;
        this.nowTurn = "";
        this.team = { A: {}, B: {} };
        this.endTimes = 2;
        this.stoneNumber = 2;
        this.turnCounter = 0;
    }
}

//indexページのルーム取得用API
app.get("/API/rooms", function (req, res) {
    let roomsJson = {};
    Object.values(rooms).forEach((room) => {
        roomsJson[room.roomId] = {
            roomName: room.roomName,
            creater: room.creater,
            players: room.players,
            roomId: room.roomId
        };
    });
    res.json(roomsJson);
});

//indexページ
app.get("/", (req, res) => {
    res.render("lobby.html", { rooms: Object.values(rooms), userName: req.session.userName });
});
//ルーム作成のメソッド
app.post("/createRoom", async (req, res) => {
    //入力したルーム名でルームを作成し、roomsへ格納
    const room = new Room(req.body.roomName, req.body.userName);
    rooms[room.roomId] = room;
    //初期ページで入力したユーザーネームと生成したルームのidをセッションに記録
    //session登録とリダイレクトのタイミングによってapp.get("/game")で弾かれることがあったのでawait実装
    await new Promise(resolve => {
        req.session.userName = req.body.userName;
        req.session.roomId = room.roomId;
        resolve();
    });
    await new Promise(resolve => {
        resolve(res.redirect("/game"));
    })
});
//ルーム参加のメソッド
app.post("/joinRoom", async (req, res) => {
    //初期ページで入力したユーザーネームと参加するルームのidをセッションに記録
    await new Promise(resolve => {
        req.session.userName = req.body.userName;
        req.session.roomId = req.body.roomId;
        resolve();
    });
    res.redirect("/game");
})

//ゲーム画面
app.get("/game", async (req, res) => {
    res.render("game");
})



//ルーティングの404エラーハンドリング
app.use(function (req, res, next) {
    res.status(404).send('ERROR 404 not found');
});



//ゲーム処理部
const Vec2 = require("./serverUtils/Vector2");
const Scenes = {
    Pose: "Pose",
    BeforeShot: "BeforeShot",
    Moving: "Moving",
    Checking: "Cheking",
    End: "End"
};
class Power {
    constructor() {
        this.start = new Vec2(0, 0);
        this.end = new Vec2(0, 0);
    }
    powerVector() {
        return this.start.sub(this.end);
    }
    stlength() {
        return this.powerVector().mag();
    }
    inputPowerVector() {
        return this.powerVector().mul(1 / 50);
    }
}
class Stone {
    constructor(position, team) {
        this.p = position;
        this.v = new Vec2(0, 0);
        this.m = 20;
        this.e = 0.8;
        this.team = team;
        if (team == "A") {
            this.teamColor = "rgb(230,230,100)"
        } else {
            this.teamColor = "rgb(255,40,80)"
        }
    }
    move() {
        //位置ベクトルに速度ベクトルを足す処理
        this.p = this.p.add(this.v.mul(2)) //fpsを30にしたので移動処理を2倍に
        //摩擦抵抗を表現するため、少しずつ速度ベクトルを現象させる。ベクトルのスカラーが0.06以下になった場合、速度ベクトルを0ベクトルとする。
        this.v = this.v.mul(1 - 0.05 * 0.2).mul(1 - 0.05 * 0.2) //fpsを30にしたので減速処理を2倍に
        if (this.v.mag() < 0.06) {
            this.v = new Vec2(0, 0);
        }
    }
    //ぶつかる対象のストーンクラスを入力すると、それぞれの反射後のベクトルが求められる。ここでは反発係数を0.8としている。
    reflect(b) {
        let v1 = this.v;
        let v2 = b.v;
        let m1 = this.m;
        let m2 = b.m;
        let ab = b.p.sub(this.p);
        let c = ab.norm();
        let vAfters = {
            va1: (c.mul((m2 / (m1 + m2)) * (1 + this.e) * (v2.sub(v1).dot(c)))).add(v1),
            va2: (c.mul((m1 / (m1 + m2)) * (1 + this.e) * (v1.sub(v2).dot(c)))).add(v2)
        }
        return vAfters
    }
}
class Player {
    constructor(userName, userId) {
        //セッションIDをユーザIDとして扱う
        this.userId = userId;
        this.userName = userName;
        this.mouseX = 240;
        this.mouseY = 700;
        this.leftClickStatus = "NO";
        this.rightClickStatus = "NO";
        this.connection = false;
        this.team = "white";
        this.coolTime = 0;
    }
}

//GameObjectの追加
class Game {
    constructor(endTimes, stoneNumber) {
        //シーン制御
        this.scene = Scenes.BeforeShot;
        this.PositionStatus = 1;
        this.turn = "A"
        //射出前のストーン各チーム
        this.stoneA = new Stone(new Vec2(240, 700), "A");
        this.stoneB = new Stone(new Vec2(240, 700), "B");
        //動的オブジェクト
        this.power = new Power();
        this.stones = [];
        this.controller = new Player("controller", "controller");

        //点数板表示用
        this.scores = {
            A: [],
            B: []
        };
        for (let i = 0; i < endTimes; i++) {
            this.scores.A.push("-");
            this.scores.B.push("-");
        };
        this.sumA = "-";
        this.sumB = "-";
        this.message1 = "";
        this.message2 = "";
        //球数やターン数など初期設定とカウンター
        this.endTimes = endTimes;
        this.endCounter = 0;
        this.stoneNumber = stoneNumber;
        this.stoneCounter = 0;
        this.clickCounter = 0;
        this.poseCounter = 0;
    }
}




//クライアントとの接続ハンドリングとユーザー入力受け付け
io.on("connection", (socket) => {
    //セッション取り込みとルームオブジェクトの取り込み
    const sessionData = socket.request.session;
    const roomId = sessionData.roomId;
    const room = rooms[roomId];
    //ルームが存在しなかった場合noRoomイベントをクライアントに送信し、以降の処理を行わない
    if (room === undefined) {
        socket.emit("noRoom");
    } else {
        //プレイヤーオブジェクトを生成し、ルーム内のplayersオブジェクトに格納
        const userId = socket.request.sessionID;
        const userName = sessionData.userName;
        //既に当該ユーザーがルームに存在する場合、ユーザーオブジェクトを再生成しない
        let player = null;
        if (room.players[userId] === undefined) {
            player = new Player(userName, userId);
            room.players[userId] = player;
        } else {
            player = room.players[userId];
            player.userName = userName;
        }
        //接続ステータスtrue
        player.connection = true;

        //クライアントとの初期化通信
        socket.emit("connection", userId);

        //ルームへ入室
        socket.join(roomId);

        //切断時の動作を追加
        socket.on("disconnect", async () => {
            //コネクションステータスをfalseにし30秒待機
            player.connection = false;
            try {
                await new Promise((resolve) => {
                    setInterval(() => {
                        resolve()
                    }, 30 * 1000);
                })
                //5秒待ってもconnectionイベントが起きなければ(connection = falseのままなら)teamからユーザーを削除
                if (player.connection === false) delete room.team[player.team][player.userId];
            } catch {
            }
        })
        //クライアントデータの受け付け
        socket.on("clientData", (client) => {
            //本番環境ではdisconnectイベントが20秒くらい遅れて発行されてしまうことから、再接続後にdisconnectイベントが実行されてしまう
            //事象が発生した。そのため、接続時だけでなく、clientDataを受信するたびにconnectionステータスをtrueにする仕様に変更
            player.connection = true;
            player.mouseX = client.mouseX;
            player.mouseY = client.mouseY;
            player.leftClickStatus = client.leftClickStatus;
            player.rightClickStatus = client.rightClickStatus;
            //ゲームオブジェクトが生成済みの状態で、nowTurnに一致するIDを持つプレイヤーを
            //コントローラーとする
            if (room.game) {
                if (room.nowTurn === client.userId) {
                    room.game.controller = client;
                };
            };
        });
    }
});

//30fpsで通信処理を行う
setInterval(() => {
    Object.values(rooms).forEach((room) => {
        //プレイヤーが一人以上存在する場合
        if (Object.keys(room.players).length > 0) {
            //プレイヤー判定の初期値をfalseにして
            let isPlayers = false;
            //プレイヤーオブジェクトを判定し、一人もオンラインのプレイヤーが居ない場合、isPlayerはfalseのままとなるので、
            // for (let player in Object.values(room.players)){
            //     if (player.connection === true) {isPlayers = true; break;};
            // }
            Object.values(room.players).forEach((player) => {
                if (player.connection === true) { isPlayers = true };
            })
            //falseのときルームを削除する
            if (isPlayers === false) delete rooms[room.roomId];
        }

        //roomごとに状態を更新
        if (room.game === null) { //ゲームオブジェクト作成前
            updataRoom(room);
            io.to(room.roomId).emit("serverData", {
                players: room.players,
                roomName: room.roomName,
                nowTurn: room.nowTurn,
                team: room.team,
                endTimes: room.endTimes,
                stoneNumber: room.stoneNumber
            });
        }
        else { //ゲームオブジェクト作成後
            updataGame(room);
            io.to(room.roomId).emit("serverData", {
                players: room.players,
                game: room.game,
                roomName: room.roomName,
                nowTurn: room.nowTurn,
                team: room.team,
            });
        }
    });
}, 1000 / 30);

//ゲームオブジェクト作成まで
function updataRoom(room) {
    let team = room.team;
    let endTimes = room.endTimes;
    let stoneNumber = room.stoneNumber;
    //疑似Break用
    let doCreate = true;
    Object.values(room.players).forEach((player) => {
        if (doCreate) {
            let mouseX = player.mouseX;
            let mouseY = player.mouseY;
            let leftClickStatus = player.leftClickStatus;
            let rightClickStatus = player.rightClickStatus;
            //参加ボードうんぬん
            //mouseX,mouseYを用いて押下判定を行い、Room.teamオブジェクトへの追加を行う
            if (350 <= mouseX && mouseX <= 470 && 160 <= mouseY && mouseY <= 670) {
                let field = (mouseY <= 410) ? "A" : "B";
                const invAB = (AorB) => {
                    return (AorB === "A") ? "B" : "A";
                }
                if (leftClickStatus === "YES") {
                    delete team[invAB(field)][player.userId];
                    team[field][player.userId] = player.userName;
                    player.team = field;
                } else if (rightClickStatus === "YES") {
                    delete team[field][player.userId];
                }
            }
            //エンド数とストーン数制御
            //0になるまでcoolTimeを減らし続ける
            if (player.coolTime > 0) player.coolTime -= 1;
            //coolTimeが0のときのみ、クリック処理を行う
            if (player.coolTime === 0 && leftClickStatus === "YES") {
                if (38 <= mouseX && mouseX <= 102 && 260 <= mouseY && mouseY <= 290) {
                    let beforeTemp = endTimes;
                    //増減処理
                    (mouseX > 70) ? endTimes += 2 : endTimes -= 2;
                    //変化後の数値が2~8の範囲を出たら増減を取りやめ
                    if (endTimes < 1 || 9 < endTimes) { endTimes = beforeTemp };
                    //クリック後のクールタイムを設ける
                    player.coolTime = 10;
                } else if (38 <= mouseX && mouseX <= 102 && 360 <= mouseY && mouseY <= 390) {
                    let beforeTemp = stoneNumber;
                    //増減処理
                    (mouseX > 70) ? stoneNumber += 2 : stoneNumber -= 2;
                    //変化後の数値が2~16の範囲を出たら増減を取りやめ
                    if (stoneNumber < 1 || 17 < stoneNumber) { stoneNumber = beforeTemp };
                    //クリック後のクールタイムを設ける
                    player.coolTime = 10;
                }
            }
            //ゲーム開始の処理
            if (20 <= mouseX && mouseX <= 120 && 410 <= mouseY && mouseY <= 440 && leftClickStatus === "YES") {
                //チームが揃っている場合のみ開始
                if (Object.keys(team.A).length !== 0 && Object.keys(team.B).length !== 0) {
                    //ゲームオブジェクトを生成
                    room.game = new Game(room.endTimes, room.stoneNumber);
                    //breakする
                    doCreate = false;
                } else {
                    ;
                }
            }
        }

    })
    room.team = team;
    room.endTimes = endTimes;
    room.stoneNumber = stoneNumber;
}

function updataGame(room) {
    const game = room.game;
    //入力
    let mouseX = game.controller.mouseX;
    let mouseY = game.controller.mouseY;
    let leftClickStatus = game.controller.leftClickStatus;
    let rightClickStatus = game.controller.rightClickStatus;

    //状態
    let scene = game.scene
    let PositionStatus = game.PositionStatus
    let turn = game.turn
    let stoneA = game.stoneA
    let stoneB = game.stoneB
    let power = game.power
    let stones = game.stones
    let scores = game.scores
    let sumA = game.sumA
    let sumB = game.sumB
    let message1 = game.message1
    let message2 = game.message2
    let endTimes = game.endTimes
    let endCounter = game.endCounter
    let stoneNumber = game.stoneNumber
    let stoneCounter = game.stoneCounter
    let clickCounter = game.clickCounter
    let poseCounter = game.poseCounter

    //総合ターンカウンター
    let turnCounter = room.turnCounter;
    //ターンのチームのメンバー数
    let length = Object.keys(room.team[turn]).length;
    // 0 0 1 1 2 2 と増える数字をチームのメンバ数で除した余り
    let selecter = Math.floor(turnCounter / 2) % length;
    //結果をターンに代入
    room.nowTurn = Object.keys(room.team[turn])[selecter];
    //結果表示のためのポーズシーン
    if (scene === Scenes.Pose) {
        if (poseCounter === 30 * 5) {
            scene = Scenes.BeforeShot;
            stones = [];
            poseCounter = 0;
        } else {
            poseCounter = poseCounter + 1;
        }
    }

    //ショット前のシーン
    if (scene === Scenes.BeforeShot) {
        let stone;
        if (turn === "A") {
            stone = stoneA;
        } else if (turn === "B") {
            stone = stoneB;
        }
        message1 = "第" + (endCounter + 1) + "エンド 残り" + (stoneNumber - stoneCounter) + "投";
        message2 = stone.team + "チームの番です。";
        //ポジション決め
        if (PositionStatus === 1) {
            let startPosition
            power.start = new Vec2(0, 0);
            power.end = new Vec2(0, 0);

            //リンクの範囲内でストーンの位置を追従
            if (mouseX < 148) {
                startPosition = 148;
            } else if (332 < mouseX) {
                startPosition = 332;
            } else {
                startPosition = mouseX;
            }
            //ストーンのx値のみ動かす
            stone.p.x = startPosition;

            //クリックされたら射出フェーズへ移動
            if (leftClickStatus === "YES") {
                PositionStatus = 2;
            }
        } //射出フェーズ
        if (PositionStatus === 2) {
            //右クリックでポジション決めフェーズへ戻る(キャンセル機能)
            if (rightClickStatus === "YES") {
                PositionStatus = 1;
            }
            //ストーンとマウスとの距離で打ち出す力と方向を定める
            power.start = new Vec2(mouseX, mouseY)
            power.end = stone.p;
            //左クリックしない状態ではカウンタを初期値に戻す
            if (leftClickStatus === "NO") {
                clickCounter = 0;
            }
            //左クリックし続けるとカウンタを貯める
            if (leftClickStatus === "YES") {
                clickCounter = clickCounter + 1;
            }
            //ホールドしたら射出
            if (clickCounter === 13) {
                //ポジションステータスは1に戻しておく
                PositionStatus = 1;
                //カウンターも0に戻しておく
                clickCounter = 0;
                //新しくストーンオブジェクトを作り、位置とチームをコピー
                let newStone = new Stone(stone.p, stone.team)
                //パワーオブジェクトから速度ベクトルを入力
                newStone.v = power.inputPowerVector();
                //終わったらパワーオブジェクトは初期値に戻しておく
                power.start = new Vec2(0, 0);
                power.end = new Vec2(0, 0);
                //stonesリストに追加
                stones.push(newStone);
                //シーンをMovingにわたす
                scene = Scenes.Moving;
            }

        }

    }

    //衝突演算のシーン
    if (scene === Scenes.Moving) {
        let stoneMany = stones.length;
        //ストーン同士の当たり判定と衝突反射
        for (let i = 0; i < stoneMany; i++) {
            let a = stones[i]
            //速度が0のストーンについては判定を行わない
            if (a.v === 0) {
                break;
            } else {

                for (let j = 0; i < stoneMany; j++) {
                    //同じストーン同士の判定は行わない
                    if (i === j) {
                        break;
                    }
                    //ストーンaとストーンbのギャップを求め、16pixel以下だった場合に判定を行う
                    let b = stones[j]
                    let ab = b.p.sub(a.p);
                    let gap = Math.round(ab.mag()) - 16;

                    if (Math.sign(gap) === -1) {
                        //reflectメソッドで衝突後の速度ベクトルを入手
                        let vAfters = a.reflect(b);
                        a.v = vAfters["va1"];
                        b.v = vAfters["va2"];
                        a.p = a.p.add(ab.norm().mul(gap / 2));
                        b.p = b.p.add(ab.norm().mul(-gap / 2));

                    }
                }
            }
        }

        //壁との当たり判定と反射
        for (let i = 0; i < stoneMany; i++) {
            let a = stones[i];
            if (a.v === 0) {
                break;
            } else {
                //X軸方向
                if (a.p.x - 8 <= 140) {
                    a.v.x = a.v.x * (-1)
                } else if (a.p.x + 8 >= 340) {
                    a.v.x = a.v.x * (-1)
                }
                //Y軸方向
                if (a.p.y - 8 <= 50) {
                    a.v.y = a.v.y * (-1)
                } else if (a.p.y + 8 >= 800) {
                    a.v.y = a.v.y * (-1)
                }
            }
        }
        //ストーンを動かす
        for (let i in stones) {
            stones[i].move();
        }

        //ストーンが全て停止したら次のターンへ移行する
        moving = false;
        for (let i in stones) {
            if (stones[i].v.mag() !== 0) {
                moving = true;
                break;
            } else {
            }
        }
        if (moving === false) {
            //ストーンカウンター加算
            stoneCounter = stoneCounter + 1;
            //総合カウンタも加算
            room.turnCounter += 1;

            //ストーンを打ち切ったらカウンタをリセットして判定シーンへ移動
            if (stoneCounter === stoneNumber) {
                stoneCounter = 0;
                scene = Scenes.Checking;
                //ストーンが残っている場合はターンを切り替え、BeforeShotシーンへ移動
            } else {
                if (turn === "A") {
                    turn = "B";
                } else {
                    turn = "A";
                }
                room.nowTurn = room.team[turn]
                scene = Scenes.BeforeShot;
            }
        }
    }

    //点数計算
    if (scene === Scenes.Checking) {
        //中心の位置ベクトルを用意
        let center = new Vec2(240, 160);
        //中心から近い順に並べかえ
        stones.sort(function (a, b) {
            if (a.p.sub(center).mag() > b.p.sub(center).mag()) {
                return 1;
            } else {
                return -1;
            }
        })
        //最も中心に近いストーンを持っているチームに得点
        let pointedTeam = stones[0].team;
        let tempScore = 0;
        //複数得点及び場外の計算処理
        for (let i in stones) {
            if (stones[i].team === pointedTeam && stones[i].p.sub(center).mag() < 80) {
                tempScore = tempScore + 1;
            } else {
                break;
            }
        }
        if (pointedTeam === "A") {
            scores.A[endCounter] = (tempScore);
            scores.B[endCounter] = (0);
        } else {
            scores.B[endCounter] = (tempScore);
            scores.A[endCounter] = (0);
        }
        message1 = "第" + (endCounter + 1) + "エンドの結果"
        message2 = pointedTeam + "チームが" + tempScore + "点獲得"
        endCounter = endCounter + 1;
        if (endCounter === endTimes) {
            sumA = 0;
            sumB = 0;
            for (let i in scores.A) {
                sumA = sumA + scores.A[i];
                sumB = sumB + scores.B[i];
            }
            scene = Scenes.End;
        } else {
            //まだエンドが残っているときはPoseを経由した後、stonesを空にしてBeforeShotから再開
            scene = Scenes.Pose;
        }
    }
    if (scene === Scenes.End) {
        message1 = "A:" + sumA + " - " + sumB + ":B"
        if (sumA > sumB) {
            message2 = "Aチームの勝利！"
        } else if (sumA < sumB) {
            message2 = "Bチームの勝利！"
        } else {
            message2 = "引き分け！"
        }
    }

    game.scene = scene;
    game.PositionStatus = PositionStatus;
    game.turn = turn;
    game.stoneA = stoneA;
    game.stoneB = stoneB;
    game.power = power;
    game.stones = stones;
    game.scores = scores;
    game.sumA = sumA;
    game.sumB = sumB;
    game.message1 = message1;
    game.message2 = message2;
    game.endTimes = endTimes;
    game.endCounter = endCounter;
    game.stoneNumber = stoneNumber;
    game.stoneCounter = stoneCounter;
    game.clickCounter = clickCounter;
    game.poseCounter = poseCounter;
}




















//起動
server.listen(port, () => {
    console.log("server started on port:" + port);
});