
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if(msg && msg.action === 'fillCredential'){
    try {
      const username = msg.username || '';
      const password = msg.password || '';
      // heuristics: tìm input password và username/email tương ứng
      const pwd = document.querySelector('input[type="password"]');
      if(!pwd){
        alert('Không tìm thấy input password trên trang này.');
        sendResponse({ok:false});
        return;
      }
      // tìm input username/email: thử các lựa chọn
      let userInput = document.querySelector('input[type="email"], input[name*=user i], input[name*=email i], input[type="text"]');
      // nếu có label liên quan, ưu tiên
      if(!userInput){
        const inputs = Array.from(document.querySelectorAll('input'));
        userInput = inputs.find(i=>/user|email|login/i.test(i.name || '') || /user|email|login/i.test(i.id || ''));
      }
      if(userInput) userInput.focus(), userInput.value = username, dispatchEvents(userInput);
      pwd.focus(); pwd.value = password; dispatchEvents(pwd);
      sendResponse({ok:true});
    } catch(e){
      console.error(e);
      sendResponse({ok:false});
    }
  }
});

// helper to trigger input/change events so frameworks detect changes
function dispatchEvents(el){
  el.dispatchEvent(new Event('input', {bubbles:true}));
  el.dispatchEvent(new Event('change', {bubbles:true}));
}

