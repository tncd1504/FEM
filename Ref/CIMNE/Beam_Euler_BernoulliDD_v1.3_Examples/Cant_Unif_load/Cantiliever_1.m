%=======================================================================
% MAT-fem_Beams 1.0  - MAT-fem is a learning tool for undestanding 
%                      the Finite Element Method with MATLAB and GiD
%=======================================================================
% PROBLEM TITLE = Cantiliever
%
%  Material Properties
%
  young  =   4.761904762e+04 ;
  poiss  =  5.820105800e-02 ;
  denss  =   0.000000000e+00 ;
  area   =   1.600000000e-03 ;
  inertia=   2.133330000e-07 ;
%
% Coordinates
%
global coordinates
coordinates = [
   4.000000000e+00   ;
   0.000000000e+00   ] ; 
%
% Elements
%
global elements
elements = [
      2   ,      1   ] ; 
%
% Fixed Nodes
%
fixnodes = [
      2  , 1 ,   0.000000000e+00  ;
      2  , 2 ,   0.000000000e+00  ] ;
%
% Point loads
%
pointload = [ ] ;
%
% Side loadsss
%
uniload = sparse ( 1 , 1 );
uniload (      1  ) =  -1.000000000e+00  ;



