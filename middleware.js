let helpers = require('./helpers')

exports.isAdmin = async function(req, res, next){
    
    let user = await helpers.getLoginUser(req)


    console.log(user);

    if (!user) {
        console.log("no user found!");
        res.redirect('/beta/')
    }

    if (user && !user.isAdmin) {
        res.redirect('/beta/')
    }

    next()
}
