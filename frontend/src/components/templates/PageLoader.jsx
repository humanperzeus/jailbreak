import React from "react";
import { BarLoader } from "react-spinners";
import "../../styles/Beta.css";
import logo from "../../assets/logo.png";
import lightSlogen from "../../assets/lightSlogen.png";

const override = {
  display: "block",
  margin: "0 auto",
  width: "200px",
};

const PageLoader = () => {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
          height: "80vh",
        }}
      >
        <div style={{ display: "block" }}>
          <div className="page-loader" style={{ textAlign: "center" }}>
            <div>
              <img
                src={logo}
                width="60"
                alt="logo"
                style={{
                  marginBottom: "10px",
                  borderRadius: "100px",
                  border: "6px double #000",
                  backgroundColor: "#ebebeb",
                  padding: "5px",
                }}
              />
              <img src={lightSlogen} width="100" alt="logo" />
            </div>
            <BarLoader color="#ccc" size={150} cssOverride={override} />
            <br />
            <span style={{ color: "#ccc" }}>Loading...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageLoader;
