chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "update") {
    // 1. 네이버 게임(치지직) 페이지가 열려있는 탭을 모두 찾습니다.
    const tabs = await chrome.tabs.query({
      url: "https://game.naver.com/*",
    });

    // 2. 열려있는 탭들에 배너 스크립트를 주입
    for (const tab of tabs) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: showUpdateNotificationBanner,
        });
      } catch (e) {
        console.log(
          `[탭 ${tab.id}] 스크립트 주입 실패 (이미 닫혔거나 권한 없음):`,
          e,
        );
      }
    }
  }
});

/**
 * 페이지 내에 업데이트 안내 배너를 표시하는 함수.
 */
function showUpdateNotificationBanner() {
  // 이미 배너가 있다면 중복 생성 방지
  if (document.getElementById("chzzk-logpower-eraser-ext-update-banner"))
    return;

  const banner = document.createElement("div");
  banner.id = "chzzk-logpower-eraser-ext-update-banner";

  // 스타일 정의
  banner.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: -60px; 
    left: 0;
    width: 100%;
    height: 50px;
    background-color: #772ce8; 
    color: white;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", sans-serif;
    z-index: 2147483647;
    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
    transition: top 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); 
  `;

  // 내부 컨텐츠 정의
  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 15px;">
      <span>🚀 <strong>통나무 파워 지우개</strong>가 업데이트되었습니다! 정상적인 사용을 위해 새로고침 해주세요.</span>
      <button id="chzzk-refresh-btn" style="
        background-color: #00ffa3;
        color: #1e1e1e;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-weight: bold;
        cursor: pointer;
        font-size: 13px;
        transition: transform 0.1s;
      ">새로고침</button>
      <button id="chzzk-close-btn" style="
        background: none;
        border: none;
        color: rgba(255,255,255,0.8);
        cursor: pointer;
        font-size: 20px;
        margin-left: 10px;
        line-height: 1;
      ">&times;</button>
    </div>
  `;

  document.body.appendChild(banner);

  // 애니메이션: 10ms 뒤에 top을 0으로 변경하여 스르륵 내려오게 함
  setTimeout(() => {
    banner.style.top = "0";
  }, 100);

  // 이벤트 리스너 등록
  const refreshBtn = banner.querySelector("#chzzk-refresh-btn");
  const closeBtn = banner.querySelector("#chzzk-close-btn");

  refreshBtn.onmouseover = () => {
    refreshBtn.style.transform = "scale(1.05)";
  };
  refreshBtn.onmouseout = () => {
    refreshBtn.style.transform = "scale(1)";
  };

  refreshBtn.onclick = () => {
    refreshBtn.innerText = "새로고침 중...";
    location.reload();
  };

  closeBtn.onclick = () => {
    banner.style.top = "-60px";
    setTimeout(() => banner.remove(), 500);
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_LOG_POWER_BALANCES") {
    (async () => {
      try {
        // credentials: 'include' 옵션은 쿠키를 포함
        // host_permissions에 해당 도메인이 있어야 작동
        const res = await fetch(
          "https://api.chzzk.naver.com/service/v1/log-power/balances",
          {
            method: "GET",
            credentials: "include",
          },
        );

        if (!res.ok) {
          throw new Error(`HTTP Error ${res.status}`);
        }

        const json = await res.json();
        sendResponse({ success: true, data: json });
      } catch (e) {
        console.error("Fetch Error:", e);
        sendResponse({ success: false, error: String(e) });
      }
    })();

    return true; // 비동기 응답을 위해 반드시 true를 반환
  }
});
