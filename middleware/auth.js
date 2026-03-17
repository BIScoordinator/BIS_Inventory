function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) return res.redirect('/login');
    if (roles.includes(req.session.user.role)) return next();
    req.flash('error', 'Access denied');
    res.redirect('/');
  };
}

function setLocals(req, res, next) {
  res.locals.user = req.session ? req.session.user : null;
  res.locals.flash = {
    success: req.flash ? req.flash('success') : [],
    error: req.flash ? req.flash('error') : []
  };
  next();
}

module.exports = { requireAuth, requireRole, setLocals };
