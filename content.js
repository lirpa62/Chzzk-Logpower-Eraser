// 설정
const HEADER_SELECTOR = "[class*='profile_common_header__']";
const LIST_ITEM_SELECTOR = "[class*='channel_power_item__']";

// 1. 페이지 로드 및 동적 변경 감지
const observer = new MutationObserver(() => {
  if (location.hash.includes("channel_power")) {
    injectButton();
    updatePageVisibility();
  }
});

observer.observe(document.body, { childList: true, subtree: true });

if (location.hash.includes("channel_power")) {
  injectButton();
  updatePageVisibility();
}

// 2. 버튼 주입
function injectButton() {
  const header = document.querySelector(HEADER_SELECTOR);
  if (header && !document.getElementById("log-eraser-trigger")) {
    const btn = document.createElement("button");
    btn.id = "log-eraser-trigger";
    btn.className = "log-eraser-btn";
    btn.innerText = "지울 통나무 파워 목록";
    btn.onclick = openPopup;

    btn.style.marginLeft = "10px";
    btn.style.cursor = "pointer";

    header.appendChild(btn);
  }
}

// 3. 팝업 열기 (스켈레톤 -> 데이터 로드 순서)
function openPopup() {
  if (document.getElementById("eraser-modal")) return;

  // 1) 껍데기(모달 틀)를 먼저 생성하고 스켈레톤을 보여줌
  const listContainer = createModalFrame();
  renderSkeleton(listContainer);

  // 2) 데이터 요청 (비동기)
  chrome.runtime.sendMessage({ type: "GET_LOG_POWER_BALANCES" }, (response) => {
    // 에러 처리
    if (chrome.runtime.lastError || !response || !response.success) {
      console.error(chrome.runtime.lastError || response?.error);
      listContainer.innerHTML = `
                <div class="eraser-empty-state">
                    <div class="eraser-empty-icon">⚠️</div>
                    <div>데이터를 불러오는데 실패했습니다.<br>새로고침 하거나 로그인을 확인해주세요.</div>
                </div>`;
      return;
    }

    const data = response.data.content.data;

    // 3) 데이터가 없으면 '빈 상태' 표시
    if (!data || data.length === 0) {
      listContainer.innerHTML = `
                <div class="eraser-empty-state">
                    <div class="eraser-empty-icon">🍂</div>
                    <div>아직 획득한 통나무 파워가 없어요.</div>
                </div>`;
      return;
    }

    // 4) 데이터가 있으면 리스트 렌더링 (스켈레톤 제거됨)
    renderList(listContainer, data);
  });
}

// 4. 모달 틀(Frame) 생성 함수
function createModalFrame() {
  const overlay = document.createElement("div");
  overlay.id = "eraser-modal";
  overlay.className = "eraser-modal-overlay";

  overlay.onclick = (e) => {
    if (e.target === overlay) {
      closePopup();
    }
  };

  const content = document.createElement("div");
  content.className = "eraser-modal-content";

  // 1. 헤더 생성
  const header = document.createElement("div");
  header.className = "eraser-modal-header";
  header.innerHTML = `
  <span>통나무 파워 관리</span>
  <button class="eraser-close-btn" type="button" aria-label="팝업 닫기"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path fill="currentColor" d="M16.6 4.933A1.083 1.083 0 1 0 15.066 3.4L10 8.468 4.933 3.4A1.083 1.083 0 0 0 3.4 4.933L8.468 10 3.4 15.067A1.083 1.083 0 1 0 4.933 16.6L10 11.532l5.067 5.067a1.083 1.083 0 1 0 1.532-1.532L11.532 10l5.067-5.067Z"></path></svg></button>
  `;

  header.querySelector(".eraser-close-btn").onclick = closePopup;

  // 2. 안내 문구 생성
  const notice = document.createElement("div");
  notice.className = "eraser-modal-notice";
  notice.innerHTML = `💡 실제 통나무 파워가 삭제되는 것이 아니라,<br><strong>화면에서만 보이지 않게</strong> 지워줍니다.`;

  // 3. 리스트 컨테이너 생성
  const listContainer = document.createElement("div");
  listContainer.className = "eraser-list";

  content.appendChild(header);
  content.appendChild(notice);
  content.appendChild(listContainer);
  overlay.appendChild(content);
  document.body.appendChild(overlay);

  // ESC 키 이벤트 등록
  document.addEventListener("keydown", handleEscKey);

  return listContainer; // 리스트를 채워넣을 컨테이너 반환
}

// ESC 키 핸들러
function handleEscKey(e) {
  if (e.key === "Escape") {
    closePopup();
  }
}

// 팝업 닫기 통합 함수
function closePopup() {
  const overlay = document.getElementById("eraser-modal");
  if (overlay) {
    // DOM에서 제거
    overlay.remove();

    // 중요: 메모리 누수 방지를 위해 ESC 키 이벤트 리스너도 반드시 제거해야 함
    document.removeEventListener("keydown", handleEscKey);
  }
}

// 5. 스켈레톤 UI 렌더링
function renderSkeleton(container) {
  container.innerHTML = ""; // 초기화
  // 5개 정도의 가짜 아이템 생성
  for (let i = 0; i < 10; i++) {
    const item = document.createElement("div");
    item.className = "eraser-item skeleton";
    item.innerHTML = `
            <div class="eraser-info">
                <div class="skeleton-img"></div>
                <div class="skeleton-text"></div>
            </div>
            <div class="skeleton-btn"></div>
        `;
    container.appendChild(item);
  }
}

// 6. 실제 리스트 렌더링 (이전 renderModal 로직 이동)
function renderList(container, channels) {
  container.innerHTML = ""; // 스켈레톤 제거

  chrome.storage.local.get(["hiddenChannels"], (result) => {
    const hiddenSet = new Set(result.hiddenChannels || []);

    channels.forEach((channel) => {
      const isHidden = hiddenSet.has(channel.channelId);

      // 인증 마크
      const verifiedIcon = channel.verifiedMark
        ? '<i class="verified-mark"></i>'
        : "";

      // 숫자 포맷
      const formattedAmount = channel.amount.toLocaleString();

      const item = document.createElement("div");
      item.className = `eraser-item ${isHidden ? "disabled" : ""}`;

      item.innerHTML = `
                <div class="eraser-info">
                    <img src="${channel.channelImageUrl}" class="eraser-img" alt="${channel.channelName}">
                    <span class="eraser-name">
                        ${channel.channelName}${verifiedIcon}
                    </span>
                </div>
                <span class="eraser-amount">${formattedAmount}</span>
                <button class="eraser-delete-btn ${isHidden ? "restore" : ""}">
                    ${isHidden ? "복구" : "지우기"}
                </button>
            `;

      const actionBtn = item.querySelector(".eraser-delete-btn");
      actionBtn.onclick = () => {
        toggleChannel(channel.channelId, item, actionBtn);
      };

      container.appendChild(item);
    });
  });
}

// 7. 토글 및 페이지 업데이트 로직 (기존과 동일)
function toggleChannel(channelId, listItemElement, btnElement) {
  chrome.storage.local.get(["hiddenChannels"], (result) => {
    let hiddenChannels = result.hiddenChannels || [];
    const index = hiddenChannels.indexOf(channelId);

    if (index > -1) {
      hiddenChannels.splice(index, 1);
      listItemElement.classList.remove("disabled");
      btnElement.classList.remove("restore");
      btnElement.innerText = "지우기";
    } else {
      hiddenChannels.push(channelId);
      listItemElement.classList.add("disabled");
      btnElement.classList.add("restore");
      btnElement.innerText = "복구";
    }

    chrome.storage.local.set({ hiddenChannels }, () => {
      updatePageVisibility();
    });
  });
}

function updatePageVisibility() {
  chrome.storage.local.get(["hiddenChannels"], (result) => {
    const hiddenChannels = result.hiddenChannels || [];
    const listItems = document.querySelectorAll(LIST_ITEM_SELECTOR);

    listItems.forEach((li) => {
      const link = li.querySelector('a[href*="chzzk.naver.com"]');
      if (link) {
        const href = link.getAttribute("href");
        const isHidden = hiddenChannels.some((id) => href && href.includes(id));

        if (isHidden) {
          li.style.display = "none";
        } else {
          li.style.display = "";
        }
      }
    });
  });
}
