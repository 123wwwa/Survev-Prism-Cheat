const fontAwesome = document.createElement('link');
fontAwesome.rel = "stylesheet";
fontAwesome.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css";
document.head.append(fontAwesome);


const styles = document.createElement('style');
styles.innerHTML = `
.surver-injector-overlay{
    position: absolute;
    top: 128px;
    left: 0px;
    width: 100%;
    pointer-events: None;
    color: #fff;
    font-family: monospace;
    text-shadow: 0 0 5px rgba(0, 0, 0, .5);
    z-index: 1;
}

.surver-injector-title{
    text-align: center;
    margin-top: 10px;
    margin-bottom: 10px;
    font-size: 25px;
    text-shadow: 0 0 10px rgba(0, 0, 0, .9);
    color: #fff;
    font-family: monospace;
    pointer-events: None;
}

.surver-injector-control{
    text-align: center;
    margin-top: 3px;
    margin-bottom: 3px;
    font-size: 18px;
}

.aimbotDot{
    position: fixed;
    top: 0;
    left: 0;
    width: 24px;
    height: 24px;
    box-sizing: border-box;
    color: #bf7aff;
    border: 2px solid currentColor;
    border-radius: 50%;
    background: linear-gradient(currentColor,currentColor) center / 2px 12px no-repeat,
                linear-gradient(currentColor,currentColor) center / 12px 2px no-repeat;
    box-shadow: 0 0 0 1px #111, 0 0 8px #0009;
    pointer-events: none;
    z-index: 901;
    transform: translateX(-50%) translateY(-50%);
    display: none;
}
.aimbotDot::after{
    content: 'TRACK';
    position: absolute;
    top: 27px;
    left: 50%;
    transform: translateX(-50%);
    font: bold 10px system-ui;
    letter-spacing: 1px;
    text-shadow: 0 1px 3px #000, 0 0 3px #000;
}
.aimbotDot.cover { color: #ffb547; border-style: dashed; }
.aimbotDot.cover::after { content: 'COVER'; }

#news-current ul{
    margin-left: 20px;
    padding-left: 6px;
}
`;

document.head.append(styles);
