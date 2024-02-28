import { Vec2 } from "./Vector2.js";
export class Drawer {
    //コンストラクタで描画コンテキストを渡す
    constructor(ctx) {
        this.ctx = ctx
    }

    background() {
        this.ctx.save();

        //背景
        this.ctx.beginPath();
        this.ctx.rect(0, 0, 481, 850);
        this.ctx.fillStyle = "rgb(201,238,252)";
        this.ctx.fill();

        //氷上
        this.ctx.beginPath();
        this.ctx.rect(140, 50, 200, 750);
        this.ctx.fillStyle = "white";
        this.ctx.fill();
        this.ctx.stroke();

        //ハウス
        const circles = {
            blue: [80, "rgb(190,210,255)"],
            white: [55, "rgb(255,255,255)"],
            red: [30, "rgb(255,150,150)"],
            center: [10, "rgb(255,255,255)"]
        };

        for (let key in circles) {
            this.ctx.beginPath();
            this.ctx.arc(240, 160, circles[key][0], 0, Math.PI * 2, false);
            this.ctx.fillStyle = circles[key][1];
            this.ctx.fill();
            this.ctx.strokeStyle = "rgb(190,190,190)";
            this.ctx.stroke();
        }

        //各種ライン
        const lines = {
            centerLine: [[240, 65], [240, 800 - 15]],
            backLine: [[140, 80], [340, 80]],
            teeLine: [[140, 160], [340, 160]],
            hogLine: [[140, 350], [340, 350]],
            hogLine2: [[140, 550], [340, 550]],
            topLine: [[220, 65], [260, 65]],
            bottomLine: [[220, 800 - 15], [260, 800 - 15]]
        }

        for (let key in lines) {
            this.ctx.beginPath();
            this.ctx.moveTo(lines[key][0][0], lines[key][0][1]);
            this.ctx.lineTo(lines[key][1][0], lines[key][1][1]);
            this.ctx.strokeStyle = "rgb(100,100,100)";
            this.ctx.stroke();
        }
        this.ctx.restore();
    }
    //ルーム名表示
    roomName(roomName) {
        this.ctx.save;
        this.ctx.font = "18px Roboto medium";
        this.ctx.fillText("ルーム名:" + roomName, 140, 35, 200);
        this.ctx.restore;
    }

    //startVec,endVec,centerOfStoneVec
    power(power = {}, centerOfStone) {
        let start = new Vec2(power.start.x, power.start.y);
        let end = new Vec2(power.end.x, power.end.y);
        let c = new Vec2(centerOfStone.x, centerOfStone.y);
        let powerVector = start.sub(end);
        let stlength = powerVector.mag();

        let p = c.add(powerVector); //先端位置ベクトル
        let cp = p.sub(c); //cpベクトル
        let o = new Vec2(-cp.y, cp.x).norm();//cpに直行した単位ベクトル
        let co = c.add(o.mul(stlength / 10)); //co位置ベクトル
        let coInv = c.add(o.mul(-stlength / 10));
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y);
        this.ctx.lineTo(co.x, co.y);
        this.ctx.lineTo(coInv.x, coInv.y);
        this.ctx.closePath();
        this.ctx.fillStyle = "rgba(250,0,0,0.5)"
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }
    //x,y,teamColor
    stone(stone = {}) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(stone.p.x, stone.p.y, 8, 0, Math.PI * 2, true);
        this.ctx.fillStyle = "rgb(100,100,100)";
        this.ctx.fill();
        this.ctx.strokeStyle = "rgb(50,50,50)";
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(stone.p.x, stone.p.y, 5.5, 0, Math.PI * 2, true);
        this.ctx.fillStyle = stone.teamColor;
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    teamBoard(team = { A: {}, B: {} }, nowTurn,players) {
        //Aチーム
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(350, 160, 120, 250);
        this.ctx.strokeStyle = "rgb(000,000,000)"
        this.ctx.fillStyle = "rgb(245,245,192)";
        this.ctx.fill();
        this.ctx.fillStyle = "rgb(000,000,000)";
        this.ctx.font = "bold 15px Century Gothic";
        Object.keys(team.A).forEach((userId, i) => {
            let selecter = (userId === nowTurn) ? "👉" : "";
            let connection = (players[userId].connection) ? "🟢" : "🔴";
            this.ctx.fillText(selecter + connection + team.A[userId], 355, 200 + 20 * i, 110);
        });
        this.ctx.stroke();
        this.ctx.restore();

        //Bチーム
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(350, 410, 120, 250);
        this.ctx.strokeStyle = "rgb(000,000,000)"
        this.ctx.fillStyle = "rgb(255,168,184)";
        this.ctx.fill();
        this.ctx.fillStyle = "rgb(000,000,000)";
        this.ctx.font = "bold 15px Century Gothic";
        Object.keys(team.B).forEach((userId, i) => {
            let selecter = (userId === nowTurn) ? "👉" : "";
            let connection = (players[userId].connection) ? "🟢" : "🔴";
            this.ctx.fillText(selecter + connection + team.B[userId], 355, 450 + 20 * i, 110);
        });
        this.ctx.stroke();
        this.ctx.restore();
    }

    paramBoard(endTimes, stoneNumber) {
        //マス表示
        this.ctx.save();
        this.ctx.font = "bold 30px Century Gothic";
        this.ctx.beginPath();
        this.ctx.rect(5, 200, 130, 100);
        this.ctx.rect(5, 300, 130, 100);
        this.ctx.fillStyle = "rgb(255,255,255)";
        this.ctx.fill();
        this.ctx.stroke();
        //パラメータ枠表示
        this.ctx.beginPath();
        this.ctx.fillStyle = "rgb(30,40,30)";
        this.ctx.rect(90, 215, 30, 30);
        this.ctx.rect(90, 315, 30, 30);
        this.ctx.fill();
        this.ctx.stroke();

        //パラメータ表示
        this.ctx.font = "bold 18px Century Gothic";
        this.ctx.fillStyle = "rgb(30,40,30)";

        this.ctx.fillText("エンド数", 12, 215 + 22);
        this.ctx.fillText("ストーン数", 12, 315 + 22, 73);
        this.ctx.fillStyle = "rgb(100,250,50)";
        this.ctx.font = "bold 30px Century Gothic";
        this.ctx.fillText(endTimes, 96, 215 + 26, 20);
        this.ctx.fillText(stoneNumber / 2, 96, 315 + 26, 20);

        //増減ボタン
        this.ctx.beginPath();
        this.ctx.fillStyle = "rgb(220,220,220)";
        this.ctx.rect(38, 260, 30, 30);
        this.ctx.rect(72, 260, 30, 30);
        this.ctx.rect(38, 360, 30, 30);
        this.ctx.rect(72, 360, 30, 30);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = "rgb(255,255,255)";

        this.ctx.fillText("◀", 39, 286, 30);
        this.ctx.fillText("▶", 71, 286, 30);
        this.ctx.strokeText("◀", 39, 286, 30);
        this.ctx.strokeText("▶", 71, 286, 30);

        this.ctx.fillText("◀", 39, 386, 30);
        this.ctx.fillText("▶", 71, 386, 30);
        this.ctx.strokeText("◀", 39, 386, 30);
        this.ctx.strokeText("▶", 71, 386, 30);

    }

    startButton() {
        //ゲーム開始ボタン
        this.ctx.beginPath();
        this.ctx.fillStyle = "rgb(255,255,255)";
        this.ctx.rect(20, 410, 100, 30);
        this.ctx.fill();
        this.ctx.fillStyle = "rgb(0,0,0)";
        this.ctx.font = "bold 16px Century Gothic";
        this.ctx.fillText("ゲーム開始！", 24, 430)
        this.ctx.stroke();
        this.ctx.restore();
    }

    //スコアボードを描画
    scoreBoard(endTimes, sumA, sumB, scores = {}) {
        //エンドマスの描画
        console.log(endTimes);
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(5, 5, 40, 40);
        this.ctx.strokeStyle = "rgb(000,000,000)"
        this.ctx.fillStyle = "rgb(255,255,255)";
        this.ctx.fill();
        this.ctx.fillStyle = "rgb(000,000,000)";
        this.ctx.font = "12px Roboto medium";
        this.ctx.fillText("エンド", 7, 30);
        this.ctx.stroke();
        this.ctx.restore();

        //Aマスの描画
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(45, 5, 40, 40);
        this.ctx.strokeStyle = "rgb(000,000,000)"
        this.ctx.fillStyle = "rgb(230,230,100)";
        this.ctx.fill();
        this.ctx.fillStyle = "rgb(000,000,000)";
        this.ctx.font = "27px Roboto medium";
        this.ctx.fillText("A", 55, 35);
        this.ctx.stroke();
        this.ctx.restore();

        //Bマスの描画
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(85, 5, 40, 40);
        this.ctx.strokeStyle = "rgb(000,000,000)"
        this.ctx.fillStyle = "rgb(255,40,80)";
        this.ctx.fill();
        this.ctx.fillStyle = "rgb(000,000,000)";
        this.ctx.font = "27px Roboto medium";
        this.ctx.fillText("B", 95, 35);
        this.ctx.stroke();
        this.ctx.restore();

        //各エンドの得点欄描画
        this.ctx.save;
        this.ctx.font = "27px Roboto medium";
        for (let i = 0; i < endTimes; i++) {
            let x = 5;
            let y = 5 + 40 * (i + 1);
            let j = i + 1;
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.fillStyle = "rgb(255,255,255)";
            this.ctx.rect(x, y, 40, 40);
            this.ctx.rect(x + 40, y, 40, 40);
            this.ctx.rect(x + 80, y, 40, 40);
            this.ctx.fill();
            this.ctx.fillStyle = "rgb(000,000,000)";
            this.ctx.fillText(j, x + 10, y + 30);
            this.ctx.fillText(scores.A[j - 1], x + 50, y + 30);
            this.ctx.fillText(scores.B[j - 1], x + 90, y + 30);
            this.ctx.stroke();
        }
        this.ctx.restore;

        //合計点欄の描画
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.fillStyle = "rgb(255,255,255)";
        this.ctx.rect(5, endTimes * 40 + 45, 40, 40);
        this.ctx.rect(5 + 40, endTimes * 40 + 45, 40, 40);
        this.ctx.rect(5 + 80, endTimes * 40 + 45, 40, 40);
        this.ctx.fill();
        this.ctx.fillStyle = "rgb(000,000,000)";
        this.ctx.font = "20px Roboto medium";
        this.ctx.fillText("合計", 6, endTimes * 40 + 42 + 30);
        this.ctx.restore();
        this.ctx.fillText(sumA, 5 + 50, endTimes * 40 + 45 + 30);
        this.ctx.fillText(sumB, 5 + 90, endTimes * 40 + 45 + 30);
        this.ctx.stroke();
    }
    //メッセージボードを描画
    message(message1, message2) {
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.fillStyle = "rgb(255,255,255)";
        this.ctx.rect(345, 5, 130, 30);
        this.ctx.rect(345, 35, 130, 50);
        this.ctx.fill();
        this.ctx.font = "20px Roboto medium";
        this.ctx.fillStyle = "rgb(000,000,000)";
        this.ctx.fillText("メッセージ欄", 350, 27);
        this.ctx.font = "12px Roboto medium";
        this.ctx.fillText(message1, 350, 54, 130);
        this.ctx.fillText(message2, 350, 71, 130);
        this.ctx.stroke();
        this.ctx.restore();
    }
    user(user = {},nowTurn) {
        this.ctx.save();
        let a = 0.5;
        if (user.userId === nowTurn){
            this.ctx.lineWidth = 3;
            a = 1;
        }
        this.ctx.beginPath();
        this.ctx.arc(user.mouseX, user.mouseY, 5, 0, Math.PI * 2, true);
        this.ctx.closePath();
        this.ctx.strokeStyle = "rgba(000,000,000,"+a+")";
        this.ctx.fillStyle = "rgba(255,255,255,"+a+")";
        switch (user.team) {
            case "A" :
                this.ctx.fillStyle = "rgba(230,230,100,"+a+")";
                break;
            case "B" :
                this.ctx.fillStyle = "rgba(255,40,80,"+a+")";
        }
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.font = "20px Roboto medium";
        this.ctx.fillStyle =  "rgba(000,000,000,"+a+")";
        this.ctx.fillText(user.userName, user.mouseX - 5, user.mouseY - 10, 130);
        this.ctx.restore();
    }
}

