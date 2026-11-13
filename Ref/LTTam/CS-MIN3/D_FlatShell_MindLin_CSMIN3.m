%--------------------------------------------------------------------------
% PURPOSE
%   Su dung phan tu CS-MIN3 cho tam vo chu nhat
%--------------------------------------------------------------------------
%   Coded by Tran Nguyen Cong Danh
%   FOSAT Group – HCMC, Vietnam
%   Email: tncd1504@gmail.com
%   Last modified: Mar 08, 2013
%--------------------------------------------------------------------------

close all; clear all; clc;
format short;
global gcoord nodes nnode nel t
E = 4.32e8;
poisson = 0.3;
% L = 1;                   % chieu dai tam
% H = 1;                   % chieu rong tam
% chieu day tam
t = 0.25;
% % Tai trong phan bo
% q = -1;
% Chia luoi phan tu
nx = 22;                  % so phan tu theo phuong x
ny = nx;                 % so phan tu theo phuong y
nel= 2*nx*ny;            % tong so phan tu
nnel=3;                  % so nut tren mot phan tu
ndof=6;                  % so bac tu do tren moi nut
edof=nnel*ndof;          % so bac tu do cua moi phan tu
nnode=(nx+1)*(ny+1);     % tong so nut
sdof=nnode*ndof;         % tong so bac tu do
% Xac dinh ma tran toa do nut va chia luoi
num_last_nodey=ny+1;                     % number of last nodal on y axis
gcoord=coord(nnode,num_last_nodey);      % xac dinh toa do nut
num_last_ele_strip1=ny;                  % number of last element on strip 1
nodes=generate_mesh(nx,ny);
%%---------------------------- buondary condition---------------------------
%--------------------------------------------------------------------------
%                        khai bao dieu kien bien
%--------------------------------------------------------------------------
[bcdof,bcval]=bcdof_ex1(ndof,nx,ny);
%---------------------------------- force----------------------------------
F=Cal_Load(nel/2,4,num_last_nodey,sdof);
%%------------------------------ Plot grid ---------------------------------
% plot_mesh(nodes,gcoord);
% return
%----------------xac dinh ma tran vat lieu Dm -------------------
% 1. la ung suat phang, 2. bien dang phang
Dm = material_matrix(1,E,poisson)*t;
%----------------xac dinh ma tran vat lieu Db -------------------
Db = material_matrix(2,E,poisson)*t^3/12;  % Ma tran vat lieu
k= 5*E/12/(1+poisson);       % he so bien dang cat
alpha= 0.1;
%--------------------------------------------------------------------------
%                          Tinh ma tran do cung
%--------------------------------------------------------------------------
K  = zeros(sdof,sdof);   % khai bao ma tran do cung ban dau la zeros
Ke = zeros(edof,edof);
nGauss= 3; % So diem Gauss [1,3,7,13]
[Gpoint,Gweight]=get_Gauss_T3(nGauss);
for i = 1:nel           % vong lap cho tat ca cac phan tu
    nd= nodes(i,:);     % cac nut cua phan tu thu i
    xe = gcoord(nd,1);   % toa do phuong x cho cac nut cua phan tu
    ye = gcoord(nd,2);   % toa do phuong y cho cac nut cua phan tu
    ze = gcoord(nd,3);
    % Chuyen ve toa do cua phan tu
    [tr3d,x,y]=T_transform_3node(xe,ye,ze,nnel);
    % Toa do trong tam cua phan tu
    xc = mean(x);
    yc = mean(y);
    % Dien tich phan tu
    Ae = 0.5*det([ 1 x(1) y(1)
                   1 x(2) y(2)
                   1 x(3) y(3)]);
    % Chieu dai cac canh cua phan tu
    Ls=[((x(1)-x(2))^2+(y(1)-y(2))^2)^0.5;
        ((x(1)-x(3))^2+(y(1)-y(3))^2)^0.5;
        ((x(3)-x(2))^2+(y(3)-y(2))^2)^0.5];
    he=max(Ls); % canh dai nhat cua phan tu
    % He so hieu chinh thanh phan cat
    Ds= k*t^3/(t^2+alpha*he^2)*eye(2);
    % Ma tran bien dang ban dau cua moi phan tu
    bm = cell(1,3);
    bb = cell(1,3);
    bs = cell(1,3);    
    for ic = 1:3 % Lap qua 3 tam giac con cua phan tu
        % Toa do cac nut tam giac con thu ic
        xs = x;
        ys = y;
        xs(ic) = xc;
        ys(ic) = yc;              
        % Lap qua cac diem Gauss
        % Ma tran bien dang cua moi tam giac con
        bm{ic}=zeros(3,3*ndof);
        bb{ic}=zeros(3,3*ndof);
        bs{ic}=zeros(2,3*ndof);
        for int=1:nGauss
            gp = Gpoint(int,:);    % Diem Gauss
            gw = Gweight(int);     % Trong so diem Gauss
            % Tinh ham dang va dao ham cua no
            [N,dNdxi,dNdeta] = shape_T3(gp(1),gp(2));
            % Tinh Jacobian
            [J] = cal_jacobi(nnel,dNdxi,dNdeta,xs,ys);
            % Tinh ma tran bien dang uon va cat
            [m,b,s] = B_MIN3_Shell(nnel,xs,ys,N,dNdxi,dNdeta,J);
            m1=m(:,1:6); m2=m(:,7:12); m3=m(:,13:18);
            b1=b(:,1:6); b2=b(:,7:12); b3=b(:,13:18);
            s1=s(:,1:6); s2=s(:,7:12); s3=s(:,13:18);
            switch ic
                case 1
                    m(:,1:ndof)         = m1/3;
                    m(:,ndof+1:2*ndof)  = m1/3+m2;
                    m(:,2*ndof+1:3*ndof)= m1/3+m3;
                    b(:,1:ndof)         = b1/3;
                    b(:,ndof+1:2*ndof)  = b1/3+b2;
                    b(:,2*ndof+1:3*ndof)= b1/3+b3;
                    s(:,1:ndof)         = s1/3;
                    s(:,ndof+1:2*ndof)  = s1/3+s2;
                    s(:,2*ndof+1:3*ndof)= s1/3+s3;
                case 2
                    m(:,1:ndof)         = m2/3+m1;
                    m(:,ndof+1:2*ndof)  = m2/3;
                    m(:,2*ndof+1:3*ndof)= m2/3+m3;
                    b(:,1:ndof)         = b2/3+b1;
                    b(:,ndof+1:2*ndof)  = b2/3;
                    b(:,2*ndof+1:3*ndof)= b2/3+b3;
                    s(:,1:ndof)         = s2/3+s1;
                    s(:,ndof+1:2*ndof)  = s2/3;
                    s(:,2*ndof+1:3*ndof)= s2/3+s3;
                case 3
                    m(:,1:ndof)         = m3/3+m1;
                    m(:,ndof+1:2*ndof)  = m3/3+m2;
                    m(:,2*ndof+1:3*ndof)= m3/3;
                    b(:,1:ndof)         = b3/3+b1;
                    b(:,ndof+1:2*ndof)  = b3/3+b2;
                    b(:,2*ndof+1:3*ndof)= b3/3;
                    s(:,1:ndof)         = s3/3+s1;
                    s(:,ndof+1:2*ndof)  = s3/3+s2;
                    s(:,2*ndof+1:3*ndof)= s3/3;
            end
            bm{ic}= bm{ic} + m*gw*det(J);
            bb{ic}= bb{ic} + b*gw*det(J);
            bs{ic}= bs{ic} + s*gw*det(J);            
        end   % Ket thuc vong lap Gauss        
    end % Ket thuc vong lap tam giac con
    % Ma tran bien dang cua phan tu
    M= (bm{1}+bm{2}+bm{3})/Ae;
    B= (bb{1}+bb{2}+bb{3})/Ae;
    S= (bs{1}+bs{2}+bs{3})/Ae;
%     return
    % Ma tran do cung phan tu
    Kbm= M'*Dm*M*Ae;
    Kbe= B'*Db*B*Ae;
    Kbs= S'*Ds*S*Ae;
    ke = Kbm+Kbe+Kbs;
    Ke = tr3d'*ke*tr3d;
    % Lap ghep vao ma tran do cung tong the
    index = index_assemble(nd,nnel,ndof);
    K(index,index) = K(index,index) + Ke;
%     % Ma tran tai phan bo phan tu
%     f  = zeros(edof,1);
%     for inf=1:nGauss
%         gpf = Gpoint(inf,:);    % Diem Gauss
%         gwf = Gweight(inf);     % Trong so diem Gauss
%         % Tinh ham dang va dao ham cua no
%         [N,dNdxi,dNdeta] = shape_T3(gpf(1),gpf(2));
%         % Tinh Jacobian
%         [J] = cal_jacobi(nnel,dNdxi,dNdeta,x,y);
%         detJ= det(J);
%         f = f + q*[0; 0; N(1); 0; 0; 0;
%                    0; 0; N(2); 0; 0; 0;
%                    0; 0; N(3); 0; 0; 0]*gwf*detJ;
%     end % Ket thuc vong lap luc phan bo
%     % Lap ghep vao ma tran luc tong the
%     F(index) = F(index) + f;
% %     return
end % Ket thuc vong lap phan tu
% return
%--------------------------------------------------------------------------
%                     Gan dieu kien bien va giai tim chuyen vi
%--------------------------------------------------------------------------
% Khu bac tu do xoay quanh truc z
for i=1:sdof
    if(abs(K(i,i)) < 1e-5)
        sum=0.0;
        for j=1:sdof
            sum=sum+abs(K(i,j));
        end
        if (sum < 1e-5)
            K(i,i)=1;
        end
    end
end
[K,F] = apply_condition_load(K,F,bcdof,bcval);
% return
U = K\F;
% Chuyen vi theo phuong z
% W = U(1:6:end);
% max_w = max(abs(W));
disp('================================================')
disp('exact deflection at A = 0.3024');
wA = -U(nnode*6-3)
energy_strain=0.5*U'*K*U
% return
%--------------------------------------------------------------------------
%                               So sanh nghiem
%--------------------------------------------------------------------------
% D1 = E*t^3/12/(1-poisson^2);
% ss_CS_MIN3 = max_w*D1/L^4
% %--------------------------------------------------------------------------
% %                               Ve do thi
% %--------------------------------------------------------------------------
% % ve chuyen vi
% figure('color',[1 1 1])
% trisurf(nodes,gcoord(:,1),gcoord(:,2),W*1e3);
% shading interp
% colorbar
% title('CHUYEN VI W (mm)')
% % view(0,90)
