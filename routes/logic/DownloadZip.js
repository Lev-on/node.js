const downloadZip = (req, res) => {
  // console.log("teteteteteteteteteeeeeeeeeeeeeee ", outputFileName_dow);

  return res.download(`./zip/${req.params.file_path}`);
};

module.exports = { downloadZip };
