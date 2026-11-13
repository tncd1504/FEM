%=======================================================================
% MAT-fem_Beams 1.0  - MAT-fem is a learning tool for undestanding 
%                      the Finite Element Method with MATLAB and GiD
%=======================================================================
% PROBLEM TITLE = Untitled
%
%  Material Properties
%
  young  =   2.000000000e+08 ;
  poiss  =  2.000000000e-01 ;
  denss  =   0.000000000e+00 ;
  area   =   1.000000000e-02 ;
  inertia=   8.333330000e-06 ;
%
% Coordinates
%
global coordinates
coordinates = [
   1.000000000e+01   ;
   5.000000000e+00   ;
   0.000000000e+00   ] ; 
%
% Elements
%
global elements
elements = [
      3   ,      2   ; 
      2   ,      1   ] ; 
%
% Fixed Nodes
%
fixnodes = [
      3  , 1 ,   0.000000000e+00  ;
      3  , 2 ,   0.000000000e+00  ] ;
%
% Point loads
%
pointload = [
      1  , 1 ,  -5.000000000e+00  ;
      1  , 2 ,   0.000000000e+00  ] ;
%
% Side loadsss
%
uniload = sparse ( 2 , 1);



