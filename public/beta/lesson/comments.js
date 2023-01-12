// let comments_wrapper = document.querySelector('.comments-wrapper');
// let allComments;
// let fetchComments = () => {
//     fetch('/beta/lesson/comments.json')
//         .then(resp => resp.json())
//         .then(res => {
//             allComments = res;
//             renderComments(allComments);
//         })
// }
// // fetchComments();

// let renderComments = (allComments) => {
//     comments_wrapper.innerHTML = allComments.map(comment => {
//         return `<div class="comment-main">
//         <div class="left">
//         <div class="comment-avatar"><img class="avatar-img" src="${comment.avatarImgPath}" /></div>
//         </div>
//         <div class="right">
//             <div class="name">${comment.name} <span class="date-time">${comment.datetime}</span></div>

//             <div class="comment-txt">${comment.comment}</div>

//             <div class="comment-reacts">
//                 <div class="thumbs-up comment-react">
//                     <a href="#">
//                         <i class="bi bi-hand-thumbs-up"></i>
//                     </a>
//                     <span class="react-count">${comment.likes}</span>
//                 </div>
//                 <div class="thumbs-down comment-react">
//                     <a href="#">
//                         <i class="bi bi-hand-thumbs-down"></i>
//                     </a>
//                     <span class="react-count">${comment.dislikes}</span>
//                 </div>
//             </div>
//         </div>
//     </div>`;
//     }).join('');
// }

// let postcomment_form = document.querySelector('.postcomment-form');
// let comment;
// let userName;
// let isLogin = document.cookie.includes('true');
// let commentFunc;

// postcomment_form.onsubmit = (e) => {
//     e.preventDefault();
//     let avatarBg = { h: Math.floor(Math.random() * 360), s: Math.floor(Math.random() * 100), l: Math.floor(Math.random() * 60) };
//     let postedCommentObj;
//     commentFunc = (avatarImgPath) => {
//         return postedCommentObj = {
//             name: userName,
//             nameInitial: 'J',
//             comment: comment,
//             datetime: new Date().toLocaleString(),
//             likes: 0,
//             dislikes: 0,
//             avatarBg: `hsl(${avatarBg.h}, ${avatarBg.s}%, ${avatarBg.l}%)`,
//             avatarImgPath: avatarImgPath,
//         }
//     }
//     commentFunc();
//     addComments();
//     let comment_submitbtn = document.querySelector('.comment-submitbtn').querySelector('input');
//     comment_submitbtn.disabled = true;

//     return false;
// }

// // if (document.cookie.includes('true')) {
// //     userImgePath = 'images/1.jpg';
// //     let comment_avatar = document.querySelector('.comment-avatar');
// //     comment_avatar.style.background = 'none';
// //     let avatar_in_form_icon = ` <img class="avatar-img" src="${userImgePath}">`;
// //     let avatar_in_form = document.querySelector('.avatar-in-form');
// //     avatar_in_form.innerHTML = avatar_in_form_icon;
// // } else {
// //     let avatar_in_form_icon = ` <i class="bi bi-person-fill"></i>`;
// //     let avatar_in_form = document.querySelector('.avatar-in-form');
// //     avatar_in_form.innerHTML = avatar_in_form_icon;
// // }

// let addComments = () => {
//     if (document.cookie.includes('true')) {
//         comment = postcomment_form.querySelector('.cmnt-comment').value;
//         userName = 'John Doe';

//         let postedComment = commentFunc(userImgePath);

//         allComments.unshift(postedComment)
//         setTimeout(() => {
//             renderComments(allComments);
//             postcomment_form.querySelector('.cmnt-comment').value = '';
//         }, 1000);

//     } else {
//         let select_avatar = document.querySelector('.select-avatar');
//         select_avatar.style.visibility = 'visible';
//         setTimeout(() => {
//             // ### SHOW AVATAR POPUP
//             let avatar_modal = document.querySelector('.avatar-modal');
//             avatar_modal.style.visibility = 'visible';
//             avatar_modal.style.opacity = '1';

//             // ### CLOSE AVATAR POPUP WHEN USER SELECTS AN AVATAR
//             let avatar_imgs = document.querySelectorAll('.avatar-img');
//             avatar_imgs.forEach((avatar_img, i) => {
//                 avatar_img.onclick = () => {
//                     comment = postcomment_form.querySelector('.cmnt-comment').value;
//                     userName = postcomment_form.querySelector('.comment-user-name').value;

//                     let postedComment = commentFunc(avatar_img.getAttribute('src'));

//                     allComments.unshift(postedComment)

//                     avatar_modal.style.visibility = 'hidden';
//                     avatar_modal.style.opacity = '0';
//                     select_avatar.style.visibility = 'hidden';

//                     setTimeout(() => {
//                         renderComments(allComments);
//                         postcomment_form.querySelector('.comment-user-name').value = '';
//                         postcomment_form.querySelector('.cmnt-comment').value = '';
//                     }, 1000);
//                 }
//             });
//         }, 1500);
//     }
// }

// // ### TOGGLE CUSTOMIZE AVATAR IN AVATAR POPUP
// let avatar_big = document.querySelector('.avatar-big');
// let isCustomizeAvatarOpened = false;

// avatar_big.onclick = () => {
//     let customize_avatar = document.querySelector('.customize-avatar');
//     let select_avatar = document.querySelector('.select-avatar');
//     let avatar_in_form = document.querySelector('.avatar-in-form');

//     if (isCustomizeAvatarOpened) {
//         isCustomizeAvatarOpened = false;

//         select_avatar.style.visibility = 'visible';
//         avatar_in_form.style.visibility = 'visible';

//         customize_avatar.style.visibility = 'hidden';
//         customize_avatar.style.opacity = '0';
//     } else {
//         isCustomizeAvatarOpened = true;

//         select_avatar.style.visibility = 'hidden';
//         avatar_in_form.style.visibility = 'hidden';

//         customize_avatar.style.visibility = 'visible';
//         customize_avatar.style.opacity = '1';
//     }
// }

// // ### DISABLE COMMENT SUBMIT BUTTON IF COMMENT IS EMPTY
// let cmnt_comment = document.querySelector('.cmnt-comment');
// cmnt_comment.onkeyup = () => {
//     let comment_submitbtn = document.querySelector('.comment-submitbtn').querySelector('input');

//     if (cmnt_comment.value !== '') {
//         comment_submitbtn.disabled = false;
//     } else {
//         comment_submitbtn.disabled = true;
//     }
// }

// document.cookie = 'isLogin = false'

