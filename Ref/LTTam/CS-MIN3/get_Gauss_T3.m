function [point,weight]=get_Gauss_T3(nGauss)

%-------------------------------------------------------------------
%  Purpose:
%     Get the integration points and weighting coefficients
%     of Gauss-Legendre quadrature for isoparametric triangular element
%
%  Synopsis:
%     [point,weight]=get_Gauss_T3(nGauss) 
%
%  Variable Description:
%     nGauss - number of integration points in the isoparametric triangular
%     element
%     point - vector containing integration points   
%     weight - vector containing weighting coefficients 
%--------------------------------------------------------------------------
% Coded by Dr. Nguyen Thoi Trung (Nguyen-Thoi T or Nguyen T.T)            %
% University of Science - Vietnam National University – HCMC, Vietnam     %
% National University of Singapore (NUS)                                  %
% email: thoitrung76@gmail.com                                            %
% Last modified: December 2009                                            %
%--------------------------------------------------------------------------

% Important note: The authors decided to release the source codes free of charge with the hope that the S-FEM technique 
% can be applied to more problems and can be further developed into even more powerful methods. 
% The authors are not be able to provide any services or user-guides, but appreciate very much your feedback on errors and suggestions, 
% so that we can improve these codes/methods in the future. If the idea, method, and any part of these codes are used in anyway,
% the users are required to cite the book and the following related original papers of the authors:

% Liu GR, The Finite element method – a practical course, Elsevier (BH), UK.  2003.
% Liu, G. R. and Nguyen Thoi Trung, Smoothed Finite Element Method, CRC press, Boca Raton, USA, 2010.
%--------------------------------------------------------------------------

if nGauss==1
    point(1,1)=[1/3];
    point(1,2)=[1/3];
    weight(1,1)=[1];
elseif nGauss==3
    point(:,1)=[1/6; 4/6; 1/6];
    point(:,2)=[1/6; 1/6; 4/6];
    weight(:,1)=[1/3; 1/3; 1/3];
elseif nGauss==7
    point(1,1)=0.1012865073235;
    point(2,1)=0.7974269853531;
    point(3,1)=0.1012865073235;
    point(4,1)=0.4701420641051;
    point(5,1)=0.4701420641051;
    point(6,1)=0.0597158717898;
    point(7,1)=0.3333333333333;
    point(1,2)=0.1012865073235;
    point(2,2)=0.1012865073235;
    point(3,2)=0.7974269853531;
    point(4,2)=0.0597158717898;
    point(5,2)=0.4701420641051;
    point(6,2)=0.4701420641051;
    point(7,2)=0.3333333333333;
    weight(1,1)=0.1259391805448;
    weight(2,1)=0.1259391805448;
    weight(3,1)=0.1259391805448;
    weight(4,1)=0.1323941527885;
    weight(5,1)=0.1323941527885;
    weight(6,1)=0.1323941527885;
    weight(7,1)=0.225;
elseif nGauss==13
    point(1,1)=0.0651301029022;
    point(2,1)=0.8697397941956;
    point(3,1)=0.0651301029022;
    point(4,1)=0.3128654960049;
    point(5,1)=0.6384441885698;
    point(6,1)=0.0486903154253;
    point(7,1)=0.6384441885698;
    point(8,1)=0.3128654960049;
    point(9,1)=0.0486903154253;
    point(10,1)=0.2603459660790;
    point(11,1)=0.4793080678419;
    point(12,1)=0.2603459660790;
    point(13,1)=0.3333333333333;
    point(1,2)=0.0651301029022;
    point(2,2)=0.0651301029022;
    point(3,2)=0.8697397941956;
    point(4,2)=0.0486903154253;
    point(5,2)=0.3128654960049;
    point(6,2)=0.6384441885698;
    point(7,2)=0.0486903154253;
    point(8,2)=0.6384441885698;
    point(9,2)=0.0486903154253;
    point(10,2)=0.2603459660790;
    point(11,2)=0.2603459660790;
    point(12,2)=0.4793080678419;
    point(13,2)=0.3333333333333;
    weight(1,1)=0.0533472356088;
    weight(2,1)=0.0533472356088;
    weight(3,1)=0.0533472356088;
    weight(4,1)=0.0771137608903;
    weight(5,1)=0.0771137608903;
    weight(6,1)=0.0771137608903;
    weight(7,1)=0.0771137608903;
    weight(8,1)=0.0771137608903;
    weight(9,1)=0.0771137608903;
    weight(10,1)=0.1756152574332;
    weight(11,1)=0.1756152574332;
    weight(12,1)=0.1756152574332;
    weight(13,1)=-0.1495700444677;
end
weight=weight/2;