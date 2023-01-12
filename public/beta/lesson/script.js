

// ### maintaining video player's height
let video_player_iframe_height = () => {
    let video_player_iframe = document.querySelector('.video-player').querySelector('iframe');
    let iframe_width = video_player_iframe.clientWidth;
    video_player_iframe.style.height = iframe_width / 1.777 + 'px';
}

window.onresize = () => {
    // video_player_iframe_height();
}

// ### show/hide toggle for translations in DIALOGUE tab
let toggle_show_hide = document.querySelectorAll('.toggle-show-hide');

toggle_show_hide.forEach((toggle, i) => {
    let isTranslationTextHidden = true;
    toggle.onclick = () => {
        let spanToHide = toggle.parentNode.querySelectorAll('span')[0];
        let spanToShow = toggle.parentNode.querySelectorAll('span')[1];

        if (isTranslationTextHidden) {
            isTranslationTextHidden = false;

            spanToShow.style.display = 'block';
            spanToHide.style.display = 'none';

            toggle.innerHTML = '<i class="bi bi-eye-fill"></i>';
        } else {
            isTranslationTextHidden = true;

            spanToShow.style.display = 'none';
            spanToHide.style.display = 'block';

            toggle.innerHTML = '<i class="bi bi-eye-slash-fill"></i>';
        }
    }
});

// ## play audio in DIALOGUE tab
let play_audio = document.querySelectorAll('.play-audio');

play_audio.forEach((audio, i) => {
    audio.onclick = () => {
        let audio_player = audio.querySelector('audio');
        let icon = audio.querySelector('i');
        if (audio_player.duration > 0 && !audio_player.paused) {
            audio_player.pause();
            if (icon){
                icon.classList.add('bi-play-fill')
                icon.classList.remove('bi-pause-fill')
            } 
        } else {
            if (icon){
                icon.classList.add('bi-pause-fill')
                icon.classList.remove('bi-play-fill')
            } 
            audio_player.play();
        }
        audio.classList.add('emit-audio');

        audio_player.onended = () => {
            audio.classList.remove('emit-audio');
        }
    }
});

var audioLesson = document.getElementById('audioLesson');
var lessonOverlay = document.getElementById('lessonOverlay');

lessonOverlay.onClick = () => {
    audioLesson.play();
}

// get id in url 
var url = document.URL;
var id;
var idKey = url.substring(url.lastIndexOf('?') + 1).split("=")[0];

if (idKey == 'videoid') {
    id = url.substring(url.lastIndexOf('?') + 1).split("=")[1];
}

let isUserPaid = true;

// let insertLesson = () => {
//     if (id) {
//         video_player.innerHTML = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
//     } else {
//         if (video_player) 
//         video_player.innerHTML = `<iframe width="560" height="315" src="https://www.youtube.com/embed/NjCYc5p8a5c" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
//     }

// }

// if (isUserPaid && document.cookie.includes('true')){
//     console.log('User has Premium Account');

//     insertLesson();
//     video_player_iframe_height();
// }else{
//     video_player_iframe_height();

//     setTimeout(() => {
//         insertLesson();
//         video_player_iframe_height();
//     }, 15000);
// }


function welcomeNotification() {
    const notification = new Notification("Welcome to New Chinese Pod", {
        body: "Lorem Ipsum is simply dummy text of the printing and typesetting industry."
    });
}

function signUpNotification() {
    const showNotificationOn = new Notification("Congratulations! Your ChinsesePod account has been created", {
        body: "Lorem Ipsum is simply dummy text of the printing and typesetting industry."
    });
}


if (Notification.permission === 'granted') {
    welcomeNotification();
} else if (Notification.permission != "denied") {
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            welcomeNotification();
        }
    })
}
