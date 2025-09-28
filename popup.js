
function maskString(str) {
  if (!str) return "";
  if (str.length <= 3) return "*".repeat(str.length);
  return str.substring(0, 3) + "*".repeat(str.length - 3);
}

function bufToHex(buf){
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
function hexToBuf(hex){
  if(!hex) return new ArrayBuffer(0)
  const bytes = hex.match(/.{1,2}/g).map(b=>parseInt(b,16));
  return new Uint8Array(bytes).buffer;
}
async function deriveKey(password, saltHex){
  const enc = new TextEncoder();
  const pwKey = await crypto.subtle.importKey(
    "raw", enc.encode(password), {name:"PBKDF2"}, false, ["deriveKey"]
  );
  const saltBuf = hexToBuf(saltHex);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(saltBuf), iterations: 200000, hash: "SHA-256" },
    pwKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt","decrypt"]
  );
  return key;
}
async function encryptWithKey(key, plaintext){
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt({name:"AES-GCM", iv}, key, enc.encode(plaintext));
  return {iv: bufToHex(iv.buffer), ct: bufToHex(ct)};
}
async function decryptWithKey(key, ivHex, ctHex){
  const iv = new Uint8Array(hexToBuf(ivHex));
  const ct = hexToBuf(ctHex);
  const plainBuf = await crypto.subtle.decrypt({name:"AES-GCM", iv}, key, ct);
  return new TextDecoder().decode(plainBuf);
}

let masterInMemory = null; 

const statusEl = document.getElementById('status');
const masterInput = document.getElementById('masterInput');
const unlockBtn = document.getElementById('unlockBtn');

unlockBtn.addEventListener('click', async () => {
  const master = masterInput.value;
  if(!master){ statusEl.textContent = 'Cần nhập master key'; return; }
  // check if masterSalt exists
  chrome.storage.local.get(['masterSalt','masterCheck'], async (res) => {
    if(!res.masterSalt){
      // first time setup
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltHex = bufToHex(salt.buffer);
      const key = await deriveKey(master, saltHex);
      const check = await encryptWithKey(key, 'master-check-v1');
      chrome.storage.local.set({masterSalt: saltHex, masterCheck: check}, () => {
        masterInMemory = master;
        statusEl.textContent = 'Đặt Master Key/ Mở khoá';
        renderCreds();
      });
    } else {
      // verify
      try {
        const key = await deriveKey(master, res.masterSalt);
        const dec = await decryptWithKey(key, res.masterCheck.iv, res.masterCheck.ct);
        if(dec === 'master-check-v1'){
          masterInMemory = master;
          statusEl.textContent = 'đã mở rồi đó';
          renderCreds();
        } else {
          statusEl.textContent = 'Master key sai';
        }
      } catch(e){
        statusEl.textContent = 'Master key sai';
      }
    }
  });
});

// Add credential
document.getElementById('saveCredBtn').addEventListener('click', async () => {
  if(!masterInMemory){ alert('Unlock với master trước'); return; }
  const site = document.getElementById('siteInput').value.trim();
  const user = document.getElementById('userInput').value.trim();
  const pass = document.getElementById('passInput').value;
  if(!site || !pass){ alert('Cần site và password'); return; }
  chrome.storage.local.get(['masterSalt','creds'], async (res) => {
    const saltHex = res.masterSalt;
    if(!saltHex){ alert('Không có masterSalt — unlock trước'); return; }
    const key = await deriveKey(masterInMemory, saltHex);
    const enc = await encryptWithKey(key, pass);
    const entry = {site, user, iv: enc.iv, ct: enc.ct};
    const creds = res.creds || [];
    creds.push(entry);
    chrome.storage.local.set({creds}, () => {
      document.getElementById('siteInput').value='';
      document.getElementById('userInput').value='';
      document.getElementById('passInput').value='';
      renderCreds();
    });
  });
});

// Render saved creds
async function renderCreds(){
  const listEl = document.getElementById('list');
  listEl.innerHTML = 'đợi tý...';
  chrome.storage.local.get(['creds'], (res) => {
    const creds = res.creds || [];
    if(creds.length === 0){
      listEl.innerHTML = '<div>Không có tài khoản nào.</div>';
      return;
    }
    listEl.innerHTML = '';
    creds.forEach((c, idx) => {
      const div = document.createElement('div');
      div.className = 'entry';
      div.innerHTML = `<strong>${c.site}</strong><div>${maskString(c.user || '')}</div>`;
  
      const fillBtn = document.createElement('button');
      fillBtn.textContent = 'tự động điền vô';
      fillBtn.className = 'smallbtn';
      fillBtn.addEventListener('click', async () => {
        if(!masterInMemory){ alert('Mở khoá trước đê!'); return; }
        chrome.storage.local.get(['masterSalt'], async (r2) => {
          const key = await deriveKey(masterInMemory, r2.masterSalt);
          try {
            const pass = await decryptWithKey(key, c.iv, c.ct);
            chrome.tabs.query({active:true,currentWindow:true}, (tabs) => {
              if(!tabs || !tabs[0]) { alert('Có cái tab nào cần được lấp đầu đâu??'); return; }
              chrome.tabs.sendMessage(tabs[0].id, {action:'fillCredential', username: c.user, password: pass, site: c.site}, (resp) => {
              });
            });
          } catch(e){
            alert('Không thể giải mã — có thể master sai');
          }
        });
      });
      // Delete button
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.className = 'smallbtn';
      delBtn.addEventListener('click', () => {
        if(!confirm('Xoá tài khoản này?')) return;
        chrome.storage.local.get(['creds'], (r3) => {
          const arr = r3.creds || [];
          arr.splice(idx,1);
          chrome.storage.local.set({creds:arr}, () => renderCreds());
        });
      });
      div.appendChild(fillBtn);
      div.appendChild(delBtn);
      listEl.appendChild(div);
    });
  });
}

// On popup load
document.addEventListener('DOMContentLoaded', () => {
  statusEl.textContent = 'Đang Khoá';
  renderCreds();
});
