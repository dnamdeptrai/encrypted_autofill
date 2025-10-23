
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if(msg && msg.action === 'fillCredential'){
    try {
      const username = msg.username || '';
      const password = msg.password || '';
      const pwd = document.querySelector('input[type="password"]');
      if(!pwd){
        alert('Không tìm thấy input password trên trang này.');
        sendResponse({ok:false});
        return;
      }
      let userInput = document.querySelector('input[type="email"], input[name*=user i], input[name*=email i], input[type="text"]');
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

function dispatchEvents(el){
  el.dispatchEvent(new Event('input', {bubbles:true}));
  el.dispatchEvent(new Event('change', {bubbles:true}));
}

