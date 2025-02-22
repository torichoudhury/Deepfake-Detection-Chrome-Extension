document.addEventListener("DOMContentLoaded", function () {
    document
      .querySelector(".nav-buttons button:nth-child(1)")
      .addEventListener("click", function () {
        window.location.href = "dashboard.html";
      });
  
    document
      .querySelector(".nav-buttons button:nth-child(2)")
      .addEventListener("click", function () {
        window.location.href = "history.html";
      });
  
    document
      .querySelector(".nav-buttons button:nth-child(3)")
      .addEventListener("click", function () {
        window.location.href = "about.html";
      });
  });