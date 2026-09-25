import { version } from "../constants.js";


class ClientUi {
    constructor() {
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        this.fps = 0;
        this.kills = 0;

        if (unsafeWindow.location.hostname !== 'resurviv.biz' && unsafeWindow.location.hostname !== 'zurviv.io' && unsafeWindow.location.hostname !== 'eu-comp.net'){
            this.initCounter("fpsCounter");
            this.initCounter("pingCounter");
            this.initCounter("killsCounter");
        }

        this.initMenu(); // left menu in lobby page
        this.initRules(); // right menu in lobby page

        this.setupWeaponBorderHandler();
    }

    initCounter(id) {
        this[id] = document.createElement("div");
        this[id].id = id;
        Object.assign(this[id].style, {
            color: "white",
            backgroundColor: "rgba(0, 0, 0, 0.2)",
            padding: "5px 10px",
            marginTop: "10px",
            borderRadius: "5px",
            fontFamily: "Arial, sans-serif",
            fontSize: "14px",
            zIndex: "10000",
            pointerEvents: "none",
        });

        const uiTopLeft = document.getElementById("ui-top-left");
        if (uiTopLeft) {
            uiTopLeft.appendChild(this[id]);
        }
    }
    
    getKills() {
      const killElement = document.querySelector(
        ".ui-player-kills.js-ui-player-kills",
      );
      if (killElement) {
        const kills = parseInt(killElement.textContent, 10);
        return isNaN(kills) ? 0 : kills;
      }
      return 0;
    }

    startPingTest() {
      const currentUrl = unsafeWindow.location.href;
      const isSpecialUrl = /\/#\w+/.test(currentUrl);

      const teamSelectElement = document.getElementById("team-server-select");
      const mainSelectElement = document.getElementById("server-select-main");

      const region =
        isSpecialUrl && teamSelectElement
          ? teamSelectElement.value
          : mainSelectElement
            ? mainSelectElement.value
            : null;

      if (region && region !== this.currentServer) {
        this.currentServer = region;
        this.resetPing();

        let servers = unsafeWindow.servers;

        if (!servers) return;

        const selectedServer = servers.find(
          (server) => region.toUpperCase() === server.region.toUpperCase(),
        );

        if (selectedServer) {
          this.pingTest = new PingTest(selectedServer);
          this.pingTest.startPingTest();
        } else {
          this.resetPing();
        }
      }
    }

    resetPing() {
      if (this.pingTest && this.pingTest.test.ws) {
        this.pingTest.test.ws.close();
        this.pingTest.test.ws = null;
      }
      this.pingTest = null;
    }

    updateHealthBars() {
      const healthBars = document.querySelectorAll("#ui-health-container");
      healthBars.forEach((container) => {
        const bar = container.querySelector("#ui-health-actual");
        if (bar) {
          const width = Math.round(parseFloat(bar.style.width));
          let percentageText = container.querySelector(".health-text");

          if (!percentageText) {
            percentageText = document.createElement("span");
            percentageText.classList.add("health-text");
            Object.assign(percentageText.style, {
              width: "100%",
              textAlign: "center",
              marginTop: "5px",
              color: "#333",
              fontSize: "20px",
              fontWeight: "bold",
              position: "absolute",
              zIndex: "10",
            });
            container.appendChild(percentageText);
          }

          percentageText.textContent = `${width}%`;
        }
      });
    }

    updateBoostBars() {
      const boostCounter = document.querySelector("#ui-boost-counter");
      if (boostCounter) {
        const boostBars = boostCounter.querySelectorAll(
          ".ui-boost-base .ui-bar-inner",
        );

        let totalBoost = 0;
        const weights = [25, 25, 40, 10];

        boostBars.forEach((bar, index) => {
          const width = parseFloat(bar.style.width);
          if (!isNaN(width)) {
            totalBoost += width * (weights[index] / 100);
          }
        });

        const averageBoost = Math.round(totalBoost);
        let boostDisplay = boostCounter.querySelector(".boost-display");

        if (!boostDisplay) {
          boostDisplay = document.createElement("div");
          boostDisplay.classList.add("boost-display");
          Object.assign(boostDisplay.style, {
            position: "absolute",
            bottom: "75px",
            right: "335px",
            color: "#FF901A",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            padding: "5px 10px",
            borderRadius: "5px",
            fontFamily: "Arial, sans-serif",
            fontSize: "14px",
            zIndex: "10",
            textAlign: "center",
          });

          boostCounter.appendChild(boostDisplay);
        }

        boostDisplay.textContent = `AD: ${averageBoost}%`;
      }
    }

    setupWeaponBorderHandler() {
        const weaponContainers = Array.from(
          document.getElementsByClassName("ui-weapon-switch"),
        );
        weaponContainers.forEach((container) => {
          if (container.id === "ui-weapon-id-4") {
            container.style.border = "3px solid #2f4032";
          } else {
            container.style.border = "3px solid #FFFFFF";
          }
        });
  
        const weaponNames = Array.from(
          document.getElementsByClassName("ui-weapon-name"),
        );
        weaponNames.forEach((weaponNameElement) => {
          const weaponContainer = weaponNameElement.closest(".ui-weapon-switch");
          const observer = new MutationObserver(() => {
            const weaponName = weaponNameElement.textContent.trim();
            let border = "#FFFFFF";
  
            switch (weaponName.toUpperCase()) { 
              case "CZ-3A1": case "G18C": case "M9": case "M93R": case "MAC-10": case "MP5": case "P30L": case "DUAL P30L": case "UMP9": case "VECTOR": case "VSS": case "FLAMETHROWER": border = "#FFAE00"; break;
              case "AK-47": case "OT-38": case "OTS-38": case "M39 EMR": case "DP-28": case "MOSIN-NAGANT": case "SCAR-H": case "SV-98": case "M1 GARAND": case "PKP PECHENEG": case "AN-94": case "BAR M1918": case "BLR 81": case "SVD-63": case "M134": case "GROZA": case "GROZA-S": border = "#007FFF"; break;
              case "FAMAS": case "M416": case "M249": case "QBB-97": case "MK 12 SPR": case "M4A1-S": case "SCOUT ELITE": case "L86A2": border = "#0f690d"; break;
              case "M870": case "MP220": case "SAIGA-12": case "SPAS-12": case "USAS-12": case "SUPER 90": case "LASR GUN": case "M1100": border = "#FF0000"; break;
              case "MODEL 94": case "PEACEMAKER": case "VECTOR (.45 ACP)": case "M1911": case "M1A1": border = "#800080"; break;
              case "DEAGLE 50": case "RAINBOW BLASTER": border = "#000000"; break;
              case "AWM-S": case "MK 20 SSR": border = "#808000"; break; 
              case "POTATO CANNON": case "SPUD GUN": border = "#A52A2A"; break;
              case "FLARE GUN": border = "#FF4500"; break; case "M79": border = "#008080"; break; case "HEART CANNON": border = "#FFC0CB"; break; 
              default: border = "#FFFFFF"; break; }
  
            if (weaponContainer && weaponContainer.id !== "ui-weapon-id-4") {
              weaponContainer.style.border = `3px solid ${border}`;
            }
          });
  
          observer.observe(weaponNameElement, {
            childList: true,
            characterData: true,
            subtree: true,
          });
        });
      }

    initMenu() {
        const middleRow = document.querySelector("#start-row-top");
        if (middleRow) Object.assign(middleRow.style, {
            display: "flex",
            flexDirection: "row",
        });


        const menu = document.createElement("div");
        menu.id = "surver-injector";
        Object.assign(menu.style, {
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          padding: "15px",
          borderRadius: "10px",
          boxShadow: "0 4px 10px rgba(0, 0, 0, 0.3)",
          fontFamily: "Arial, sans-serif",
          fontSize: "18px",
          color: "#fff",
          maxWidth: "300px",
          height: "100%",
          overflowY: "auto",
          marginRight: "30px",
          boxSizing: "border-box",
        });

      
        const title = document.createElement("h2");
        title.textContent = "Social networks";
        title.className = 'news-header';
        Object.assign(title.style, {
          margin: "0 0 10px",
          fontSize: "20px",
        });
        menu.append(title);

        const description = document.createElement("p");
        description.className = "news-paragraph";
        description.style.fontSize = "14px";
        description.innerHTML = `⭐ Star us on GitHub`
        menu.append(description);
      
        const createSocialLink = (text) => {
          const a = document.createElement("a");
          a.textContent = `${text}`;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          Object.assign(a.style, {
            display: "block",
            border: "none",
            color: "#fff",
            padding: "10px",
            borderRadius: "5px",
            marginBottom: "10px",
            fontSize: "15px",
            lineHeight: "14px",
            cursor: "pointer",
            textAlign: "center",
            textDecoration: "none",
          });
          return a;
        };
      
        const githubLink = createSocialLink("");
        githubLink.style.backgroundColor = "#0c1117";
        githubLink.href = __INJECTOR_PROJECT_URL__;
        githubLink.innerHTML = `<i class="fa-brands fa-github"></i> Survev Prism Cheat`;
        menu.append(githubLink);

        const discordLink = createSocialLink("Join Discord");
        discordLink.href = "https://discord.gg/FVWzqn5k";
        discordLink.style.backgroundColor = "#5865F2";
        menu.append(discordLink);
        
        const additionalDescription = document.createElement("p");
        additionalDescription.className = "news-paragraph";
        additionalDescription.style.fontSize = "14px";
        additionalDescription.innerHTML = `Star the repository to support the project, or join Discord for discussion.`
        menu.append(additionalDescription);

        const leftColumn = document.querySelector('#left-column');
        if (!leftColumn) return;
        leftColumn.replaceChildren();
        leftColumn.style.marginTop = "10px";
        leftColumn.style.marginBottom = "27px";
        leftColumn.append(menu);
      
        this.menu = menu;
    }

    initRules() {
        const newsBlock = document.querySelector("#news-block");
        if (!newsBlock) return;
        newsBlock.innerHTML = `
<h3 class="news-header">Survev Prism Cheat v${version}</h3>
<p class="news-paragraph">Press <strong>TAB</strong> to open settings and <strong>ESC</strong> to close them.</p>
<ul>
    <li><strong>B</strong> — Aim assist</li>
    <li><strong>Z</strong> — Zoom</li>
    <li><strong>M</strong> — Automatic melee</li>
    <li><strong>Y</strong> — Spin</li>
    <li><strong>T</strong> — Focus target</li>
    <li><strong>V</strong> — Lock weapon</li>
</ul>`;
    }

    startUpdateLoop() {
      const now = performance.now();
      const delta = now - this.lastFrameTime;

      this.frameCount++;

      if (delta >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / delta);
        this.frameCount = 0;
        this.lastFrameTime = now;

        this.kills = this.getKills();

        if (this.fpsCounter) {
          this.fpsCounter.textContent = `FPS: ${this.fps}`;
        }

        if (this.killsCounter) {
          this.killsCounter.textContent = `Kills: ${this.kills}`;
        }

        if (this.pingCounter && this.pingTest) {
          const result = this.pingTest.getPingResult();
          this.pingCounter.textContent = `PING: ${result.ping} ms`;
        }
      }

      this.startPingTest();
      this.updateBoostBars();
      this.updateHealthBars();
    }
    
  }

class PingTest {
    constructor(selectedServer) {
      this.ptcDataBuf = new ArrayBuffer(1);
      this.test = {
        region: selectedServer.region,
        url: `wss://${selectedServer.url}/ptc`,
        ping: 9999,
        ws: null,
        sendTime: 0,
        retryCount: 0,
      };
    }

    startPingTest() {
      if (!this.test.ws) {
        const ws = new WebSocket(this.test.url);
        ws.binaryType = "arraybuffer";

        ws.onopen = () => {
          this.sendPing();
          this.test.retryCount = 0;
        };

        ws.onmessage = () => {
          const elapsed = (Date.now() - this.test.sendTime) / 1e3;
          this.test.ping = Math.round(elapsed * 1000);
          this.test.retryCount = 0;
          setTimeout(() => this.sendPing(), 200);
        };

        ws.onerror = () => {
          this.test.ping = "Error";
          this.test.retryCount++;
          if (this.test.retryCount < 5) {
            setTimeout(() => this.startPingTest(), 2000);
          } else {
            this.test.ws.close();
            this.test.ws = null;
          }
        };

        ws.onclose = () => {
          this.test.ws = null;
        };

        this.test.ws = ws;
      }
    }

    sendPing() {
      if (this.test.ws.readyState === WebSocket.OPEN) {
        this.test.sendTime = Date.now();
        this.test.ws.send(this.ptcDataBuf);
      }
    }

    getPingResult() {
      return {
        region: this.test.region,
        ping: this.test.ping,
      };
    }
}

// Retain the existing ticker integration.
unsafeWindow.GameMod = new ClientUi();
