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
  area   =   0.160000000e+00 ;
  inertia=   0.002133333e+00 ;
%
% Coordinates
%
global coordinates
coordinates = [
   1.000000000e+01   ;
   8.750000000e+00   ;
   7.500000000e+00   ;
   6.250000000e+00   ;
   5.000000000e+00   ;
   3.750000000e+00   ;
   2.500000000e+00   ;
   1.250000000e+00   ;
   0.000000000e+00   ] ; 
%
% Elements
%
global elements
elements = [
      9   ,      8   ; 
      8   ,      7   ; 
      7   ,      6   ; 
      6   ,      5   ; 
      5   ,      4   ; 
      4   ,      3   ; 
      3   ,      2   ; 
      2   ,      1   ] ; 
%
% Fixed Nodes
%
fixnodes = [
      9  , 1 ,   0.000000000e+00  ;
      9  , 2 ,   0.000000000e+00  ] ;
%
% Point loads
%
pointload = [
      1  , 1 ,  -5.000000000e+00  ;
      1  , 2 ,   0.000000000e+00  ] ;
%
% Side loadsss
%
uniload = sparse ( 8 , 1);



